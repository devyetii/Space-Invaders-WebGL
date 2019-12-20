import { Scene } from '../common/game';
import ShaderProgram from '../common/shader-program';
import Mesh from '../common/mesh';
import * as MeshUtils from '../common/mesh-utils';
import Camera from '../common/camera';
import FlyCameraController from '../common/camera-controllers/fly-camera-controller';
import { vec3, mat4 } from 'gl-matrix';
import { Vector, Selector } from '../common/dom-utils';
import { createElement, StatelessProps, StatelessComponent } from 'tsx-create-element';
import { Key } from 'ts-key-enum';

// In this scene we will draw a full scene into a texture, then draw another scene on the screen with the rendered texture drawn on a cube
export default class FrameBufferScene extends Scene {
    program: ShaderProgram;
    cameras: Camera[] = []; // We will use 2 cameras, one for the screen and one for the texture
    controllers: FlyCameraController[] = []; // One controller for each camera
    controlledCameraIndex: number = 0;
    meshes: {[name: string]: Mesh} = {};
    textures: {[name: string]: WebGLTexture} = {};
    sampler: WebGLSampler;
    frameBuffer: WebGLFramebuffer; // This will hold the frame buffer object

    public load(): void {
        this.game.loader.load({
            ["texture.vert"]:{url:'shaders/texture.vert', type:'text'},
            ["texture.frag"]:{url:'shaders/texture.frag', type:'text'},
            ["house-model"]:{url:'models/House/House.obj', type:'text'},
            ["house-texture"]:{url:'models/House/House.jpeg', type:'image'},
            ["moon-texture"]:{url:'images/moon.jpg', type:'image'}
        });
    } 
    
    public start(): void {
        this.program = new ShaderProgram(this.gl);
        this.program.attach(this.game.loader.resources["texture.vert"], this.gl.VERTEX_SHADER);
        this.program.attach(this.game.loader.resources["texture.frag"], this.gl.FRAGMENT_SHADER);
        this.program.link();

        this.meshes['moon'] = MeshUtils.Sphere(this.gl);
        this.meshes['cube'] = MeshUtils.Cube(this.gl);
        this.meshes['ground'] = MeshUtils.Plane(this.gl, {min:[0,0], max:[20,20]});
        this.meshes['house'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["house-model"]);

        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        
        this.textures['moon'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['moon']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['moon-texture']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        
        this.textures['ground'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['ground']);
        const C0 = [26, 26, 16], C1 = [255, 255, 255];
        const W = 1024, H = 1024, cW = 256, cH = 256;
        let data = Array(W*H*3);
        for(let j = 0; j < H; j++){
            for(let i = 0; i < W; i++){
                data[i + j*W] = (Math.floor(i/cW) + Math.floor(j/cH))%2 == 0 ? C0 : C1;
            }
        }
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, W, H, 0, this.gl.RGB, this.gl.UNSIGNED_BYTE, new Uint8Array(data.flat()));
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        
        this.textures['house'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['house']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['house-texture']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);

        const WIDTH = 512, HEIGHT = 512;
        // Here, we will create 2 textures to be the render targets
        // The first texture will be the color target where we will render the color of our pixels
        this.textures['color-target'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['color-target']);
        // texStorage2D can be used instead of texImage2D since we only allocate storage but don't supply any image
        // The parameters are:
        // target: which bound texture should we allocate memory for
        // levels: the number of mipmap levels we want. here we choose, ceil(log2(max(width, height))) to create the full mipmap chain down to 1x1
        // internalFormat: what format to use for storing data. Here we picked RGBA8 which means the we want 4 channels: R, G, B, A, and each channel will store 8 bits
        // width: the width of the texture.
        // height: the height of the texture.
        this.gl.texStorage2D(this.gl.TEXTURE_2D, Math.ceil(Math.log2(Math.max(WIDTH, HEIGHT)) + 1), this.gl.RGBA8, WIDTH, HEIGHT);

        // The second texture will be the depth target where we will store the depth of our pixels. This is needed for depth testing only
        this.textures['depth-target'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['depth-target']);
        // the depth target must have the same size as the color target. However, we only need 1 mipmap level since we will not render it later.
        // Notice that the internal format is DEPTH_COMPONENT16. We could pick something larger if we want more precision such as DEPTH_COMPONENT24 and DEPTH_COMPONENT32F
        // Also, since we only have a depth component, we can't use the stencil buffer. If we need stencil, we can pick DEPTH24_STENCIL8 or DEPTH32F_STENCIL8
        this.gl.texStorage2D(this.gl.TEXTURE_2D, 1, this.gl.DEPTH_COMPONENT16, WIDTH, HEIGHT);

        this.frameBuffer = this.gl.createFramebuffer(); // Now, we create our frame buffer
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffer); // Then we bind it
        // Then we attach the 2 textures we created to the frame buffer.
        // The parameters are:
        // target: which bound framebuffer to attach the texture to.
        // attachment: the attachment slot to use. 
        //      For colors, we have COLOR_ATTACHMENT0 upto COLOR_ATTACHMENT15.
        //      For depth, we have DEPTH_ATTACHMENT.
        //      For stencil, we have STENCIL_ATTACHMENT.
        //      For textures with both depth and stencil, we have DEPTH_STENCIL_ATTACHMENT.
        //      Note, that we can attach up to 16 color targets but can only attach 1 depth and/or stencil target.
        // textarget: the texture target. For 2D textures, it is TEXTURE_2D. for Cubemaps, it is one of the 6 face of the cubemap.
        // texture: the texture to attach.
        // level: which mip level of the texture to attach. 
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.textures['color-target'], 0);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, this.gl.TEXTURE_2D, this.textures['depth-target'], 0);

        // Next, we check to see if the framebuffer if ready for rendering.
        let status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
        if (status != this.gl.FRAMEBUFFER_COMPLETE) {
            if (status == this.gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT)
                console.error("The framebuffer has a type mismatch");
            else if (status == this.gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT)
                console.error("The framebuffer is missing an attachment");
            else if (status == this.gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS)
                console.error("The framebuffer has dimension mismatch");
            else if (status == this.gl.FRAMEBUFFER_UNSUPPORTED)
                console.error("The framebuffer has an attachment with unsupported format");
            else if (status == this.gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE)
                console.error("The framebuffer has multisample mismatch");
            else
                console.error("The framebuffer has an unknown error");
        }

        this.sampler = this.gl.createSampler();
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
        this.gl.bindSampler(0, this.sampler);

        this.cameras[0] = new Camera();
        this.cameras[0].type = 'perspective';
        this.cameras[0].position = vec3.fromValues(4,4,4);
        this.cameras[0].direction = vec3.fromValues(-1,-1,-1);
        this.cameras[0].aspectRatio = this.gl.drawingBufferWidth/this.gl.drawingBufferHeight;
        
        this.controllers[0] = new FlyCameraController(this.cameras[0], this.game.input);
        this.controllers[0].movementSensitivity = 0.01;

        this.cameras[1] = new Camera();
        this.cameras[1].type = 'perspective';
        this.cameras[1].position = vec3.fromValues(0,2,0);
        this.cameras[1].direction = vec3.fromValues(-1,0,-2);
        this.cameras[1].aspectRatio = 1;
        
        this.controllers[1] = new FlyCameraController(this.cameras[1], this.game.input);
        this.controllers[1].movementSensitivity = 0.01;

        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);
        this.gl.frontFace(this.gl.CCW);

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);


        this.setupControls();
    }
    
    public draw(deltaTime: number): void {
        this.controllers[this.controlledCameraIndex].update(deltaTime);
        if(this.game.input.isKeyJustDown('x')) this.controlledCameraIndex = (this.controlledCameraIndex+1)%this.controllers.length;

        // To start drawing to a framebuffer, we have to bind it
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffer);
        this.gl.viewport(0, 0, 512, 512); // Since the framebuffer size is smaller than the canvas, we set the viewport to match the framebuffer
        {        
            this.gl.clearColor(0.88,0.65,0.15,1);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT); // This will clear the textures attached to the framebuffer
            
            this.program.use();

            let VP = this.cameras[1].ViewProjectionMatrix;

            let groundMat = mat4.clone(VP);
            mat4.scale(groundMat, groundMat, [100, 1, 100]);

            this.program.setUniformMatrix4fv("MVP", false, groundMat);
            this.program.setUniform4f("tint", [0.96, 0.91, 0.64, 1]);

            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['ground']);
            this.program.setUniform1i('texture_sampler', 0);
            
            this.meshes['ground'].draw(this.gl.TRIANGLES);

            let houseMat = mat4.clone(VP);
            mat4.translate(houseMat, houseMat, [-10, 0, -10]);

            this.program.setUniformMatrix4fv("MVP", false, houseMat);
            this.program.setUniform4f("tint", [1, 1, 1, 1]);

            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['house']);
            this.program.setUniform1i('texture_sampler', 0);
            
            this.meshes['house'].draw(this.gl.TRIANGLES);

            let moonMat = mat4.clone(VP);
            mat4.translate(moonMat, moonMat, [0, 10, -15]);
            mat4.rotateZ(moonMat, moonMat, Math.PI/8);
            mat4.rotateY(moonMat, moonMat, performance.now()/1000);

            this.program.setUniformMatrix4fv("MVP", false, moonMat);
            this.program.setUniform4f("tint", [1, 1, 1, 1]);

            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['moon']);
            this.program.setUniform1i('texture_sampler', 0);
            
            this.meshes['moon'].draw(this.gl.TRIANGLES);
        }
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); // After we are done rendering to the framebuffer, we revert to the screen.
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures["color-target"]);
        this.gl.generateMipmap(this.gl.TEXTURE_2D); // since we only render to mip level 0, the other mip level will be empty so we need to generate them.
        
        this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight); // Now we will set the viewport to cover the whole canvas
        {
            this.gl.clearColor(0.08,0.32,0.44,1);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
            
            this.program.use();

            let VP = this.cameras[0].ViewProjectionMatrix;

            let groundMat = mat4.clone(VP);
            mat4.scale(groundMat, groundMat, [100, 1, 100]);

            this.program.setUniformMatrix4fv("MVP", false, groundMat);
            this.program.setUniform4f("tint", [0.15, 0.4, 0.44, 1]);

            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['ground']);
            this.program.setUniform1i('texture_sampler', 0);
            
            this.meshes['ground'].draw(this.gl.TRIANGLES);

            let moonMat = mat4.clone(VP);
            mat4.translate(moonMat, moonMat, [0, 1, 0]);

            this.program.setUniformMatrix4fv("MVP", false, moonMat);
            this.program.setUniform4f("tint", [1, 1, 1, 1]);

            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['color-target']); // Now we can use the color target as a normal texture.
            this.program.setUniform1i('texture_sampler', 0);
            
            this.meshes['cube'].draw(this.gl.TRIANGLES);
        }
    }
    
    public end(): void {
        this.program.dispose();
        this.program = null;
        for(let key in this.meshes)
            this.meshes[key].dispose();
        this.meshes = {};
        this.gl.deleteFramebuffer(this.frameBuffer);
        for(let key in this.textures)
            this.gl.deleteTexture(this.textures[key]);
        this.textures = {};
        this.clearControls();
    }


    /////////////////////////////////////////////////////////
    ////// ADD CONTROL TO THE WEBPAGE (NOT IMPORTNANT) //////
    /////////////////////////////////////////////////////////
    private setupControls() {
        const controls = document.querySelector('#controls');
        
        

        controls.appendChild(
            <div>
            </div>
            
        );
        
    }

    private clearControls() {
        const controls = document.querySelector('#controls');
        controls.innerHTML = "";
    }


}