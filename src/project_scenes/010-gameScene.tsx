import { Scene } from '../common/game';
import ShaderProgram from '../common/shader-program';
import Mesh from '../common/mesh';
import * as MeshUtils from '../common/mesh-utils';
import Camera from '../common/camera';
import FlyCameraController from '../common/camera-controllers/fly-camera-controller';
import { vec3, mat4, quat } from 'gl-matrix';
import { Vector, Selector } from '../common/dom-utils';
import { createElement, StatelessProps, StatelessComponent } from 'tsx-create-element';

// In this scene we will draw a scene and use framebuffers on a cube map to emulate reflection and refraction.
export default class  gameScene extends Scene {
    programs: {[name: string]: ShaderProgram} = {};
    camera: Camera;
    controller: FlyCameraController;
    meshes: {[name: string]: Mesh} = {};
    textures: {[name: string]: WebGLTexture} = {};
    sampler: WebGLSampler;

    currentMesh: string;
    tint: [number, number, number] = [255, 255, 255];
    refraction: boolean = false;
    refractiveIndex: number = 1.0;

    objectPosition: vec3 = vec3.fromValues(0, 1, -10);
    objectRotation: vec3 = vec3.fromValues(0, 0, 0);
    objectScale: vec3 = vec3.fromValues(1, 1, 1);

    frames: {[name: string]:{
        frameBuffer: WebGLFramebuffer,
        camera: Camera,
        target: number
    }} = {};

    readonly CUBEMAP_SIZE = 256;
    // These are the 6 cubemap directions: -x, -y, -z, +x, +y, +z
    static readonly cubemapDirections = ['negx', 'negy', 'negz', 'posx', 'posy', 'posz']

    public load(): void {
        this.game.loader.load({
            ["texture-cube.vert"]:{url:'shaders/texture-cube.vert', type:'text'},
            ["texture-cube.frag"]:{url:'shaders/texture-cube.frag', type:'text'},
            ["texture.vert"]:{url:'shaders/texture.vert', type:'text'},
            ["texture.frag"]:{url:'shaders/texture.frag', type:'text'},
            ["house-model"]:{url:'models/House/House.obj', type:'text'},
            ["house-texture"]:{url:'models/House/House.jpeg', type:'image'},
            ["moon-texture"]:{url:'images/moon.jpg', type:'image'},
            ["spaceship-texture"]:{url:'models/spaceships/Textures/sh3.jpg', type:'image'},
            ["suzanne"]:{url:'models/Suzanne/Suzanne.obj', type:'text'},
            ["spaceship"]:{url:'models/spaceships/Sample_Ship.obj', type:'text'},
            //Sample_Ship.obj
        });
    }
    
    public start(): void {
        this.programs['texture-cube'] = new ShaderProgram(this.gl);
        this.programs['texture-cube'].attach(this.game.loader.resources["texture-cube.vert"], this.gl.VERTEX_SHADER);
        this.programs['texture-cube'].attach(this.game.loader.resources["texture-cube.frag"], this.gl.FRAGMENT_SHADER);
        this.programs['texture-cube'].link();

        this.programs['texture'] = new ShaderProgram(this.gl);
        this.programs['texture'].attach(this.game.loader.resources["texture.vert"], this.gl.VERTEX_SHADER);
        this.programs['texture'].attach(this.game.loader.resources["texture.frag"], this.gl.FRAGMENT_SHADER);
        this.programs['texture'].link();

        this.meshes['suzanne'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources['suzanne']);
        this.meshes['cube'] = MeshUtils.Cube(this.gl);
        this.meshes['moon'] = MeshUtils.Sphere(this.gl);
        this.meshes['ground'] = MeshUtils.Plane(this.gl, {min:[0,0], max:[20,20]});
        this.meshes['house'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["house-model"]);
        this.meshes['spaceship'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["spaceship"]);
        
        this.currentMesh = 'suzanne';

        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        
        this.textures['moon'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['moon']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['moon-texture']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);

        this.textures['spaceship'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['spaceship']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['spaceship-texture']);
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
        
        // These will be our 6 targets for loading the images to the texture
        const target_directions = [
            this.gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            this.gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            this.gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
            this.gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            this.gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            this.gl.TEXTURE_CUBE_MAP_POSITIVE_Z
        ];

        const cameraDirections = [
            [-1,  0,  0],
            [ 0, -1,  0],
            [ 0,  0, -1],
            [ 1,  0,  0],
            [ 0,  1,  0],
            [ 0,  0,  1]
        ];

        const cameraUps = [
            [ 0, -1,  0],
            [ 0,  0, -1],
            [ 0, -1,  0],
            [ 0, -1,  0],
            [ 0,  0, -1],
            [ 0, -1,  0]
        ];

        const miplevels = Math.ceil(Math.log2(this.CUBEMAP_SIZE));
        
        this.textures['environment'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.textures['environment']); // Here, we will bind the texture to TEXTURE_CUBE_MAP since it will be a cubemap
        // we only allocate the face storage
        this.gl.texStorage2D(this.gl.TEXTURE_CUBE_MAP, miplevels, this.gl.RGBA8, this.CUBEMAP_SIZE, this.CUBEMAP_SIZE);
        // this.gl.generateMipmap(this.gl.TEXTURE_CUBE_MAP); // Then we generate the mipmaps

        this.textures['environment-depth'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.textures['environment-depth']); // Here, we will bind the texture to TEXTURE_CUBE_MAP since it will be a cubemap
        this.gl.texStorage2D(this.gl.TEXTURE_CUBE_MAP, 1, this.gl.DEPTH_COMPONENT16, this.CUBEMAP_SIZE, this.CUBEMAP_SIZE);

        for(let i = 0; i < 6; i++){
            const direction = gameScene.cubemapDirections[i];
            
            let camera = new Camera();
            camera.direction = vec3.clone(cameraDirections[i]);
            camera.up = vec3.clone(cameraUps[i]);
            camera.perspectiveFoVy = Math.PI/2;
            camera.aspectRatio = 1;
            
            let frameBuffer = this.gl.createFramebuffer();
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, frameBuffer);
            this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, target_directions[i], this.textures['environment'], 0);
            this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, target_directions[i], this.textures['environment-depth'], 0);

            if(this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) != this.gl.FRAMEBUFFER_COMPLETE)
                console.error("Frame Buffer is Incomplete");

            this.frames[direction] = {frameBuffer: frameBuffer, camera: camera, target: target_directions[i]};
        }

        this.sampler = this.gl.createSampler();
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);

        this.camera = new Camera();
        this.camera.type = 'perspective';
        this.camera.position = vec3.fromValues(0,2,0);
        this.camera.direction = vec3.fromValues(-1,0,-2);
        this.camera.aspectRatio = this.gl.drawingBufferWidth/this.gl.drawingBufferHeight;
        
        this.controller = new FlyCameraController(this.camera, this.game.input);
        this.controller.movementSensitivity = 0.01;
        this.controller.fastMovementSensitivity = 0.05;

        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);
        this.gl.frontFace(this.gl.CCW);

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);

        this.gl.clearColor(0,0,0,1);

        this.setupControls();
    }
    
    public draw(deltaTime: number): void {
        this.controller.update(deltaTime);

        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        for(let face in this.frames){
            let frame = this.frames[face];
            frame.camera.position = this.objectPosition;
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, frame.frameBuffer);
            this.gl.viewport(0, 0, this.CUBEMAP_SIZE, this.CUBEMAP_SIZE);
            this.drawScene(frame.camera.ViewProjectionMatrix);
        }
        this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.textures['environment']);
        this.gl.generateMipmap(this.gl.TEXTURE_CUBE_MAP);
        

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);

        this.drawScene(this.camera.ViewProjectionMatrix);
        
        let program = this.programs['texture-cube'];
        program.use();

        program.setUniformMatrix4fv("VP", false, this.camera.ViewProjectionMatrix);
        program.setUniform3f("cam_position", this.camera.position);

        let M = mat4.fromRotationTranslationScale(
            mat4.create(),
            quat.fromEuler(quat.create(), this.objectRotation[0], this.objectRotation[1], this.objectRotation[2]),
            this.objectPosition,
            this.objectScale
        );
        
        program.setUniformMatrix4fv("M", false, M);
        // We send the model matrix inverse transpose since normals are transformed by the inverse transpose to get correct world-space normals
        program.setUniformMatrix4fv("M_it", true, mat4.invert(mat4.create(), M));

        program.setUniform4f("tint", [this.tint[0]/255, this.tint[1]/255, this.tint[2]/255, 1]);
        program.setUniform1f('refraction', this.refraction?1:0);
        program.setUniform1f('refractive_index', this.refractiveIndex);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.textures['environment']);
        program.setUniform1i('cube_texture_sampler', 0);
        this.gl.bindSampler(0, this.sampler);

        this.meshes[this.currentMesh].draw(this.gl.TRIANGLES);
        
    }

    private drawScene(VP: mat4){
        this.gl.clearColor(0.88,0.65,0.15,1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT); // This will clear the textures attached to the framebuffer
        
        let program = this.programs['texture'];
        program.use();

        let groundMat = mat4.clone(VP);
        mat4.scale(groundMat, groundMat, [100, 1, 100]);

        program.setUniformMatrix4fv("MVP", false, groundMat);
        program.setUniform4f("tint", [0.96, 0.91, 0.64, 1]);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['ground']);
        program.setUniform1i('texture_sampler', 0);
        
        this.meshes['ground'].draw(this.gl.TRIANGLES);

        let houseMat = mat4.clone(VP);
        mat4.translate(houseMat, houseMat, [-10, 0, -10]);

        program.setUniformMatrix4fv("MVP", false, houseMat);
        program.setUniform4f("tint", [1, 1, 1, 1]);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['house']);
        program.setUniform1i('texture_sampler', 0);
        
        this.meshes['house'].draw(this.gl.TRIANGLES);

        let moonMat = mat4.clone(VP);
        mat4.translate(moonMat, moonMat, [0, 10, -15]);
        mat4.rotateZ(moonMat, moonMat, Math.PI/8);
        mat4.rotateY(moonMat, moonMat, performance.now()/1000);

        program.setUniformMatrix4fv("MVP", false, moonMat);
        program.setUniform4f("tint", [1, 1, 1, 1]);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['moon']);
        program.setUniform1i('texture_sampler', 0);
        
        this.meshes['moon'].draw(this.gl.TRIANGLES);

        let spaceshipMat = mat4.clone(VP);
        mat4.translate(spaceshipMat, spaceshipMat, [0, 5, -10]);
        mat4.rotateZ(spaceshipMat, spaceshipMat, Math.PI/8);
        mat4.rotateY(spaceshipMat, spaceshipMat, performance.now()/1000);

        program.setUniformMatrix4fv("MVP", false, spaceshipMat);
        program.setUniform4f("tint", [1, 1, 1, 1]);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['spaceship']);
        program.setUniform1i('texture_sampler', 0);
        
        this.meshes['spaceship'].draw(this.gl.TRIANGLES);
    }
    
    public end(): void {
        for(let key in this.programs)
            this.programs[key].dispose();
        this.programs = {};
        for(let key in this.meshes)
            this.meshes[key].dispose();
        this.meshes = {};
        for(let key in this.textures)
            this.gl.deleteTexture(this.textures[key]);
        this.textures = {};
        this.gl.deleteSampler(this.sampler);
        this.clearControls();
    }


    /////////////////////////////////////////////////////////
    ////// ADD CONTROL TO THE WEBPAGE (NOT IMPORTNANT) //////
    /////////////////////////////////////////////////////////
    private setupControls() {
        const controls = document.querySelector('#controls');

        const RGBToHex = (rgb: [number, number, number]): string => {
            let arraybuffer = new ArrayBuffer(4);
            let dv = new DataView(arraybuffer);
            dv.setUint8(3, 0);
            dv.setUint8(2, rgb[0]);
            dv.setUint8(1, rgb[1]);
            dv.setUint8(0, rgb[2]);
            return '#' + dv.getUint32(0, true).toString(16);
        }

        const HexToRGB = (hex: string): [number, number, number] => {
            let arraybuffer = new ArrayBuffer(4);
            let dv = new DataView(arraybuffer);
            dv.setUint32(0, Number.parseInt(hex.slice(1), 16), true);
            return [dv.getUint8(2), dv.getUint8(1), dv.getUint8(0)];
        }
        
        controls.appendChild(
            <div>
                <div className="control-row">
                    <label className="control-label">Model:</label>
                    <Selector options={Object.fromEntries(Object.keys(this.meshes).map((x)=>[x,x]))} value={this.currentMesh} onchange={(v)=>{this.currentMesh=v;}}/> 
                </div>
                <div className="control-row">
                    <label className="control-label">Tint:</label>
                    <input type="color" value={RGBToHex(this.tint)} onchange={(ev: InputEvent)=>{this.tint = HexToRGB((ev.target as HTMLInputElement).value)}}/>
                </div>
                <div className="control-row">
                    <input type="checkbox" checked={this.refraction?true:undefined} onchange={(ev: InputEvent)=>{this.refraction = ((ev.target as HTMLInputElement).checked)}}/>
                    <label className="control-label">Refractive Index:</label>
                    <input type="number" value={this.refractiveIndex} onchange={(ev: InputEvent)=>{this.refractiveIndex=Number.parseFloat((ev.target as HTMLInputElement).value)}} step="0.1"/>
                </div>
                <div className="control-row">
                    <label className="control-label">Object Position</label>
                    <Vector vector={this.objectPosition}/>    
                </div>
                <div className="control-row">
                    <label className="control-label">Object Rotation</label>
                    <Vector vector={this.objectRotation}/> 
                </div>
                <div className="control-row">
                    <label className="control-label">Object Scale</label>
                    <Vector vector={this.objectScale}/> 
                </div>
            </div>
            
        );
        
    }

    private clearControls() {
        const controls = document.querySelector('#controls');
        controls.innerHTML = "";
    }


}