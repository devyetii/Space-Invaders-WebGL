import { Scene } from '../common/game';
import ShaderProgram from '../common/shader-program';
import Mesh from '../common/mesh';
import * as MeshUtils from '../common/mesh-utils';
import Camera from '../common/camera';
import FlyCameraController from '../common/camera-controllers/fly-camera-controller';
import { vec3, mat4 } from 'gl-matrix';
import { Vector, Selector } from '../common/dom-utils';
import { createElement, StatelessProps, StatelessComponent } from 'tsx-create-element';

// In this scene we will draw one rectangle with a texture
export default class myTerrianScene extends Scene {
    program: ShaderProgram;
    camera: Camera;
    controller: FlyCameraController;
    meshes: {[name: string]: Mesh} = {};
    textures: {[name: string]: WebGLTexture} = {};
    samplers: {[name: string]: WebGLSampler} = {};

    groundWidth:number = 2000;
    groundLength:number = 2000  ;
    public load(): void {
        // These shaders take 2 uniform: MVP for 3D transformation and Tint for modifying colors
        this.game.loader.load({
            ["terrain.vert"]:{url:'shaders/terrain.vert', type:'text'},
            ["terrain.frag"]:{url:'shaders/terrain.frag', type:'text'},
            ["terrain-texture"]:{url:'images/terrain.jpg', type:'image'},
            ["grass-texture"]:{url:'images/grass_ground_d.jpg', type:'image'},
            ["mountain-texture"]:{url:'images/mntn_white_d.jpg', type:'image'}
        });
    }
    
    public start(): void {
        this.program = new ShaderProgram(this.gl);
        this.program.attach(this.game.loader.resources["terrain.vert"], this.gl.VERTEX_SHADER);
        this.program.attach(this.game.loader.resources["terrain.frag"], this.gl.FRAGMENT_SHADER);
        this.program.link();

        this.meshes['ground'] = MeshUtils.SubdividedPlane(this.gl, [this.groundWidth, this.groundLength]);
        
        
        this.textures['terrain'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['terrain']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['terrain-texture']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);

        this.textures['grass'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['grass']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['grass-texture']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        
        this.textures['mountain'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['mountain']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['mountain-texture']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);


        this.samplers['height'] = this.gl.createSampler();
        this.gl.samplerParameteri(this.samplers['height'], this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.samplerParameteri(this.samplers['height'], this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.samplerParameteri(this.samplers['height'], this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.samplerParameteri(this.samplers['height'], this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);

        this.samplers['color'] = this.gl.createSampler();
        this.gl.samplerParameteri(this.samplers['color'], this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.samplerParameteri(this.samplers['color'], this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.samplerParameteri(this.samplers['color'], this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.samplerParameteri(this.samplers['color'], this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);

        this.camera = new Camera();
        this.camera.type = 'perspective';
        this.camera.position = vec3.fromValues(0,100,100);
        this.camera.direction = vec3.fromValues(-1,-1,-1);
        this.camera.aspectRatio = this.gl.drawingBufferWidth/this.gl.drawingBufferHeight;
        
        this.controller = new FlyCameraController(this.camera, this.game.input);
        this.controller.movementSensitivity = 0.01;
        this.controller.fastMovementSensitivity = 0.05;

        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);
        this.gl.frontFace(this.gl.CCW);

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);

        this.gl.clearColor(0.0,0.0,1.0,1);

        this.setupControls();
    }
    
    public draw(deltaTime: number): void {
        this.controller.update(deltaTime);

        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        
        this.program.use();

        this.program.setUniformMatrix4fv("VP", false, this.camera.ViewProjectionMatrix);
        this.program.setUniform3f("cam_position", this.camera.position);

        let groundMat = mat4.create();
        mat4.scale(groundMat, groundMat, [200, 100, 200]);

        this.program.setUniformMatrix4fv("M", false, groundMat);

        this.program.setUniform4f("tint", [1, 1, 1, 1]);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['terrain']);
        this.program.setUniform1i('terrain_texture_sampler', 0);
        this.gl.bindSampler(0, this.samplers['height']);

        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['grass']);
        this.program.setUniform1i('bottom_texture_sampler', 1);
        this.gl.bindSampler(1, this.samplers['color']);

        this.gl.activeTexture(this.gl.TEXTURE2);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['mountain']);
        this.program.setUniform1i('top_texture_sampler', 2);
        this.gl.bindSampler(2, this.samplers['color']);

        this.program.setUniform2f('tiling_factor', [100, 100]);
        this.program.setUniform2f('mixing_heights', [0.4, 0.6]);

        this.program.setUniform4f('fog_color', [0.0, 0.0, 0.9, 1]);
        this.program.setUniform1f('fog_distance', 150);
        
        this.meshes['ground'].draw(this.gl.TRIANGLES);

        
    }
    
    public end(): void {
        this.program.dispose();
        this.program = null;
        for(let key in this.meshes)
            this.meshes[key].dispose();
        this.meshes = {};
        for(let key in this.textures)
            this.gl.deleteTexture(this.textures[key]);
        this.textures = {};
        for(let key in this.samplers)
            this.gl.deleteSampler(this.samplers[key]);
        this.samplers = {};
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