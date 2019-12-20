import { Scene } from '../common/game';
import ShaderProgram from '../common/shader-program';
import Mesh from '../common/mesh';
import * as MeshUtils from '../common/mesh-utils';
import Camera from '../common/camera';
import FlyCameraController from '../common/camera-controllers/fly-camera-controller';
import { vec3, mat4, quat } from 'gl-matrix';
import { Vector, Selector } from '../common/dom-utils';
import { createElement } from 'tsx-create-element';

// In this scene we will draw a scene to multiple targets then show the targets together on the screen
export default class PostprocessingScene extends Scene {
    programs: { [name: string]: ShaderProgram } = {};
    camera: Camera;
    controller: FlyCameraController;
    meshes: { [name: string]: Mesh } = {};
    textures: { [name: string]: WebGLTexture } = {};
    samplers: { [name: string]: WebGLSampler } = {};
    frameBuffer: WebGLFramebuffer; // This will hold the frame buffer object

    public load(): void {
        this.game.loader.load({
            ["mrt.vert"]: { url: 'shaders/mrt.vert', type: 'text' },
            ["mrt.frag"]: { url: 'shaders/mrt.frag', type: 'text' },
            ["fullscreen.vert"]: { url: 'shaders/post-process/fullscreen.vert', type: 'text' },
            ["blit.frag"]: { url: 'shaders/post-process/blit.frag', type: 'text' },
            ["house-model"]: { url: 'models/House/House.obj', type: 'text' },
            ["house-texture"]: { url: 'models/House/House.jpeg', type: 'image' },
            ["moon-texture"]: { url: 'images/moon.jpg', type: 'image' }
        });
    }

    public start(): void {
        // This shader program will draw 3D objects
        this.programs["3d"] = new ShaderProgram(this.gl);
        this.programs["3d"].attach(this.game.loader.resources["mrt.vert"], this.gl.VERTEX_SHADER);
        this.programs["3d"].attach(this.game.loader.resources["mrt.frag"], this.gl.FRAGMENT_SHADER);
        this.programs["3d"].link();

        // This shader program will render a texture fullscreen.
        this.programs["blit"] = new ShaderProgram(this.gl);
        this.programs["blit"].attach(this.game.loader.resources["fullscreen.vert"], this.gl.VERTEX_SHADER);
        this.programs["blit"].attach(this.game.loader.resources["blit.frag"], this.gl.FRAGMENT_SHADER);
        this.programs["blit"].link();
    
        this.meshes['moon'] = MeshUtils.Sphere(this.gl);
        this.meshes['cube'] = MeshUtils.Cube(this.gl);
        this.meshes['ground'] = MeshUtils.Plane(this.gl, { min: [0, 0], max: [20, 20] });
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
        let data = Array(W * H * 3);
        for (let j = 0; j < H; j++) {
            for (let i = 0; i < W; i++) {
                data[i + j * W] = (Math.floor(i / cW) + Math.floor(j / cH)) % 2 == 0 ? C0 : C1;
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

        // Here, we will create 3 target textures: 2 color targets and 1 depth target.
        // All 3 target will have the same size as the canvas.
        // The first target texture will color the object colors. It will have the format RGBA8.
        this.textures['color-target'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['color-target']);
        this.gl.texStorage2D(this.gl.TEXTURE_2D, 1, this.gl.RGBA8, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);

        // The second target texture will hold the surface normal. It will have the format RGBA32F since we want to store floating point data and the values could be negative.
        this.gl.getExtension('EXT_color_buffer_float'); // Floating point render targets are not supported by default, so we need to get their extension.
        this.textures['normal-target'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['normal-target']);
        this.gl.texStorage2D(this.gl.TEXTURE_2D, 1, this.gl.RGBA32F, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);

        // The third target texture will hold the pixel depth.
        this.textures['depth-target'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['depth-target']);
        this.gl.texStorage2D(this.gl.TEXTURE_2D, 1, this.gl.DEPTH_COMPONENT32F, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);

        // As usual, we will create a frame buffer and attach the targets to it.
        // Note that we use both COLOR_ATTACHMENT0 and COLOR_ATTACHMENT1
        this.frameBuffer = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffer);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.textures['color-target'], 0);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT1, this.gl.TEXTURE_2D, this.textures['normal-target'], 0);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, this.gl.TEXTURE_2D, this.textures['depth-target'], 0);

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

        // This sampler will be used for regulat 3D rendering
        this.samplers['regular'] = this.gl.createSampler();
        this.gl.samplerParameteri(this.samplers['regular'], this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.samplerParameteri(this.samplers['regular'], this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.samplerParameteri(this.samplers['regular'], this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.samplerParameteri(this.samplers['regular'], this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);

        // This will be used for drawing the frame buffer onto the screen.
        this.samplers['postprocess'] = this.gl.createSampler();
        this.gl.samplerParameteri(this.samplers['postprocess'], this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.samplerParameteri(this.samplers['postprocess'], this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.samplerParameteri(this.samplers['postprocess'], this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.samplerParameteri(this.samplers['postprocess'], this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);

        this.camera = new Camera();
        this.camera.type = 'perspective';
        this.camera.position = vec3.fromValues(4, 4, 4);
        this.camera.direction = vec3.fromValues(-1, -1, -1);
        this.camera.aspectRatio = this.gl.drawingBufferWidth / this.gl.drawingBufferHeight;

        this.controller = new FlyCameraController(this.camera, this.game.input);
        this.controller.movementSensitivity = 0.01;

        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);
        this.gl.frontFace(this.gl.CCW);

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);


        this.setupControls();
    }

    public draw(deltaTime: number): void {
        this.controller.update(deltaTime);

        // To start drawing to a framebuffer, we have to bind it
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffer);
        {
            this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
            // To enable rendering to multiple targets, we need to tell WebGL which attachment has render buffers using gl.drawBuffers.
            this.gl.drawBuffers([this.gl.COLOR_ATTACHMENT0, this.gl.COLOR_ATTACHMENT1]);
            // Since we have 2 color targets. gl.clear will clear both with the same color which is not what we want.
            // So we use gl.clearBufferfv and gl.clearBufferfi for clearing color targets and depth-stencil targets, respectively.
            this.gl.clearBufferfv(this.gl.COLOR, 0, [0.88, 0.65, 0.15, 1]); // Clear the first color target (color texture)
            this.gl.clearBufferfv(this.gl.COLOR, 1, [0, 0, 0, 1]); // Clear the second color target (normal texture)
            this.gl.clearBufferfi(this.gl.DEPTH_STENCIL, 0, 1, 0); // Clear the depth-stencil target (depth texture)

            this.gl.bindSampler(0, this.samplers['regular']);

            let program = this.programs['3d'];
            program.use();

            program.setUniformMatrix4fv("VP", false, this.camera.ViewProjectionMatrix);

            let groundMat = mat4.create();
            mat4.scale(groundMat, groundMat, [100, 1, 100]);

            program.setUniformMatrix4fv("M", false, groundMat);
            program.setUniformMatrix4fv("M_it", true, mat4.invert(mat4.create(), groundMat)); // We need the matrxi inverse transpose for the normal transformation to world space.
            program.setUniform4f("tint", [0.96, 0.91, 0.64, 1]);

            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['ground']);
            program.setUniform1i('texture_sampler', 0);
            this.gl.bindSampler(0, this.samplers['regular']);

            this.meshes['ground'].draw(this.gl.TRIANGLES);

            let houseMat = mat4.create();
            mat4.translate(houseMat, houseMat, [-10, 0, -10]);

            program.setUniformMatrix4fv("M", false, houseMat);
            program.setUniformMatrix4fv("M_it", true, mat4.invert(mat4.create(), houseMat)); // We need the matrxi inverse transpose for the normal transformation to world space.
            program.setUniform4f("tint", [1, 1, 1, 1]);

            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['house']);
            program.setUniform1i('texture_sampler', 0);

            this.meshes['house'].draw(this.gl.TRIANGLES);

            let moonMat = mat4.create();
            mat4.translate(moonMat, moonMat, [0, 10, -15]);
            mat4.rotateZ(moonMat, moonMat, Math.PI / 8);
            mat4.rotateY(moonMat, moonMat, performance.now() / 1000);

            program.setUniformMatrix4fv("M", false, moonMat);
            program.setUniformMatrix4fv("M_it", true, mat4.invert(mat4.create(), moonMat)); // We need the matrxi inverse transpose for the normal transformation to world space.
            program.setUniform4f("tint", [1, 1, 1, 1]);

            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['moon']);
            program.setUniform1i('texture_sampler', 0);

            this.meshes['moon'].draw(this.gl.TRIANGLES);
        }
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); // Now we return to the canvas frame buffer

        {
            this.gl.clearColor(0, 0, 0, 1);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

            
            this.gl.bindSampler(0, this.samplers['postprocess']);

            let program = this.programs['blit'];
            program.use();

            // Here, we will draw each texture to one quadrant of the screen
            this.gl.viewport(0, 0, this.gl.drawingBufferWidth/2, this.gl.drawingBufferHeight/2);
 
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['color-target']);
            program.setUniform1i('color_sampler', 0);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);

            this.gl.viewport(this.gl.drawingBufferWidth/2, 0, this.gl.drawingBufferWidth/2, this.gl.drawingBufferHeight/2);
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['depth-target']);
            program.setUniform1i('color_sampler', 0);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);

            this.gl.viewport(0, this.gl.drawingBufferHeight/2, this.gl.drawingBufferWidth/2, this.gl.drawingBufferHeight/2);
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['normal-target']);
            program.setUniform1i('color_sampler', 0);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
        }
    }

    public end(): void {
        for (let key in this.programs)
            this.programs[key].dispose();
        this.programs = {};
        for (let key in this.meshes)
            this.meshes[key].dispose();
        this.meshes = {};
        this.gl.deleteFramebuffer(this.frameBuffer);
        for (let key in this.textures)
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