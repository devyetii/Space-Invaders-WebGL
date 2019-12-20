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
export default class CubemapScene extends Scene {
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
    drawSky: boolean = true;

    static readonly cubemapDirections = ['negx', 'negy', 'negz', 'posx', 'posy', 'posz']

    public load(): void {
        // These shaders take 2 uniform: MVP for 3D transformation and Tint for modifying colors
        this.game.loader.load({
            ["texture-cube.vert"]:{url:'shaders/texture-cube.vert', type:'text'},
            ["texture-cube.frag"]:{url:'shaders/texture-cube.frag', type:'text'},
            ["sky-cube.vert"]:{url:'shaders/sky-cube.vert', type:'text'},
            ["sky-cube.frag"]:{url:'shaders/sky-cube.frag', type:'text'},
            ["suzanne"]:{url:'models/Suzanne/Suzanne.obj', type:'text'},
            ...Object.fromEntries(CubemapScene.cubemapDirections.map(dir=>[dir, {url:`images/Vasa/${dir}.jpg`, type:'image'}]))
        });
    }
    
    public start(): void {
        this.programs['texture'] = new ShaderProgram(this.gl);
        this.programs['texture'].attach(this.game.loader.resources["texture-cube.vert"], this.gl.VERTEX_SHADER);
        this.programs['texture'].attach(this.game.loader.resources["texture-cube.frag"], this.gl.FRAGMENT_SHADER);
        this.programs['texture'].link();

        
        this.programs['sky'] = new ShaderProgram(this.gl);
        this.programs['sky'].attach(this.game.loader.resources["sky-cube.vert"], this.gl.VERTEX_SHADER);
        this.programs['sky'].attach(this.game.loader.resources["sky-cube.frag"], this.gl.FRAGMENT_SHADER);
        this.programs['sky'].link();

        this.meshes['suzanne'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources['suzanne']);
        this.meshes['cube'] = MeshUtils.Cube(this.gl);
        this.meshes['sphere'] = MeshUtils.Sphere(this.gl);
        this.currentMesh = 'suzanne';
        
        const target_directions = [
            this.gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            this.gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            this.gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
            this.gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            this.gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            this.gl.TEXTURE_CUBE_MAP_POSITIVE_Z
        ]

        this.textures['environment'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.textures['environment']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        for(let i = 0; i < 6; i++){
            this.gl.texImage2D(target_directions[i], 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources[CubemapScene.cubemapDirections[i]]);
        }
        this.gl.generateMipmap(this.gl.TEXTURE_CUBE_MAP);

        this.sampler = this.gl.createSampler();
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);

        this.camera = new Camera();
        this.camera.type = 'perspective';
        this.camera.position = vec3.fromValues(1.5,1.5,1.5);
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

        this.gl.clearColor(0,0,0,1);

        this.setupControls();
    }
    
    public draw(deltaTime: number): void {
        this.controller.update(deltaTime);

        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        
        this.programs['texture'].use();

        this.programs['texture'].setUniformMatrix4fv("VP", false, this.camera.ViewProjectionMatrix);
        this.programs['texture'].setUniform3f("cam_position", this.camera.position);

        let M = mat4.create();
        mat4.translate(M,M,vec3.fromValues(10,1,1))
        mat4.rotateY(M, M, performance.now()/1000);
        
        this.programs['texture'].setUniformMatrix4fv("M", false, M);
        this.programs['texture'].setUniformMatrix4fv("M_it", true, mat4.invert(mat4.create(), M));

        this.programs['texture'].setUniform4f("tint", [this.tint[0]/255, this.tint[1]/255, this.tint[2]/255, 1]);
        this.programs['texture'].setUniform1f('refraction', this.refraction?1:0);
        this.programs['texture'].setUniform1f('refractive_index', this.refractiveIndex);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.textures['environment']);
        this.programs['texture'].setUniform1i('cube_texture_sampler', 0);
        this.gl.bindSampler(0, this.sampler);

        this.meshes[this.currentMesh].draw(this.gl.TRIANGLES);

        if(this.drawSky){
            this.gl.cullFace(this.gl.FRONT);
            this.gl.depthMask(false);

            this.programs['sky'].use();

            this.programs['sky'].setUniformMatrix4fv("VP", false, this.camera.ViewProjectionMatrix);
            this.programs['sky'].setUniform3f("cam_position", this.camera.position);

            let skyMat = mat4.create();
            mat4.translate(skyMat, skyMat, this.camera.position);
            
            this.programs['sky'].setUniformMatrix4fv("M", false, skyMat);

            this.programs['sky'].setUniform4f("tint", [1, 1, 1, 1]);

            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.textures['environment']);
            this.programs['sky'].setUniform1i('cube_texture_sampler', 0);
            this.gl.bindSampler(0, this.sampler);

            this.meshes['cube'].draw(this.gl.TRIANGLES);
            
            this.gl.cullFace(this.gl.BACK);
            this.gl.depthMask(true);
        }
        
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
                    <input type="checkbox" checked={this.drawSky} onchange={(ev: InputEvent)=>{this.drawSky = ((ev.target as HTMLInputElement).checked)}}/>
                    <label className="control-label">Draw Sky</label>
                </div>
            </div>
            
        );
        
    }

    private clearControls() {
        const controls = document.querySelector('#controls');
        controls.innerHTML = "";
    }


}