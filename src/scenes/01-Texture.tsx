import { Scene } from '../common/game';
import ShaderProgram from '../common/shader-program';
import Mesh from '../common/mesh';
import Camera from '../common/camera';
import FlyCameraController from '../common/camera-controllers/fly-camera-controller';
import { vec3, mat4 } from 'gl-matrix';
import { Vector, Selector } from '../common/dom-utils';
import { createElement, StatelessProps, StatelessComponent } from 'tsx-create-element';

// In this scene we will draw one rectangle with a texture
export default class TextureScene extends Scene {
    program: ShaderProgram;
    mesh: Mesh;
    camera: Camera;
    controller: FlyCameraController;
    textures: WebGLTexture[] = [];
    current_texture: number = 0;
    sampler: WebGLSampler;
    sampler2: WebGLSampler;

    texcoordinates: Float32Array = new Float32Array([
        0, 1,
        1, 1,
        1, 0,
        0, 0,
    ]);
    wrap_s: number;
    wrap_t: number;
    mag_filter: number;
    min_filter: number;

    public load(): void {
        // These shaders take 2 uniform: MVP for 3D transformation and Tint for modifying colors
        this.game.loader.load({
            ["texture.vert"]:{url:'shaders/texture.vert', type:'text'},
            ["texture.frag"]:{url:'shaders/texture.frag', type:'text'},
            ["texture"]:{url:'images/color-grid.png', type:'image'}
        });
    } 
    
    public start(): void {
        this.program = new ShaderProgram(this.gl);
        this.program.attach(this.game.loader.resources["texture.vert"], this.gl.VERTEX_SHADER);
        this.program.attach(this.game.loader.resources["texture.frag"], this.gl.FRAGMENT_SHADER);
        this.program.link();

        // Create a colored rectangle using our new Mesh class
        this.mesh = new Mesh(this.gl, [
            { attributeLocation: 0, buffer: "positions", size: 3, type: this.gl.FLOAT, normalized: false, stride: 0, offset: 0 },
            { attributeLocation: 1, buffer: "colors", size: 4, type: this.gl.UNSIGNED_BYTE, normalized: true, stride: 0, offset: 0 },
            { attributeLocation: 2, buffer: "texcoords", size: 2, type: this.gl.FLOAT, normalized: false, stride: 0, offset: 0 },
        ]);
        this.mesh.setBufferData("positions", new Float32Array([
            -0.5, -0.5, 0.0,
            0.5, -0.5, 0.0,
            0.5,  0.5, 0.0,
            -0.5,  0.5, 0.0,
        ]), this.gl.STATIC_DRAW);
        this.mesh.setBufferData("colors", new Uint8Array([
            255, 225, 255, 255,
            255, 255, 255, 255,
            255, 255, 255, 255,
            255, 255, 255, 255,
        ]), this.gl.STATIC_DRAW);
        this.mesh.setElementsData(new Uint32Array([
            0, 1, 2,
            2, 3, 0
        ]), this.gl.STATIC_DRAW);

        {
            this.textures[0] = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[0]);
            const image: ImageData = this.game.loader.resources['texture'];
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA8, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
            this.gl.generateMipmap(this.gl.TEXTURE_2D);
        }

        {
            this.textures[1] = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[1]);
            const W = [255, 255, 255], Y = [255, 255, 0], B = [0, 0, 0];
            const data = new Uint8Array([
                ...W, ...W, ...W, ...Y, ...Y, ...Y, ...W, ...W, ...W,
                ...W, ...W, ...Y, ...Y, ...Y, ...Y, ...Y, ...W, ...W,
                ...W, ...Y, ...Y, ...Y, ...Y, ...Y, ...Y, ...Y, ...W,
                ...Y, ...Y, ...B, ...Y, ...Y, ...Y, ...B, ...Y, ...Y,
                ...Y, ...Y, ...B, ...Y, ...Y, ...Y, ...B, ...Y, ...Y,
                ...Y, ...Y, ...Y, ...Y, ...Y, ...Y, ...Y, ...Y, ...Y,
                ...W, ...Y, ...Y, ...B, ...B, ...B, ...Y, ...Y, ...W,
                ...W, ...W, ...Y, ...Y, ...Y, ...Y, ...Y, ...W, ...W,
                ...W, ...W, ...W, ...Y, ...Y, ...Y, ...W, ...W, ...W
            ]);
            this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB8, 9, 9, 0, this.gl.RGB, this.gl.UNSIGNED_BYTE, data);
            this.gl.generateMipmap(this.gl.TEXTURE_2D);
        }

        {
            this.textures[2] = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[2]);
            const WIDTH = 256, HEIGHT = 256;
            const data = new Uint8Array(WIDTH*HEIGHT);
            for(let j = HEIGHT; j >= 0 ; j--){
                for(let i = WIDTH; i >= 0 ; i--){
                    data[i + j*WIDTH] = (i+j)/2;
                }
            }
            this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.LUMINANCE, WIDTH, HEIGHT, 0, this.gl.LUMINANCE, this.gl.UNSIGNED_BYTE, data);
            this.gl.generateMipmap(this.gl.TEXTURE_2D);
        }

        {
            this.textures[3] = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[3]);
            const WIDTH = 256, HEIGHT = 256;
            const data = new Float32Array(WIDTH*HEIGHT);
            for(let j = 0; j < HEIGHT; j++){
                for(let i = 0; i < WIDTH; i++){
                    data[i + j*WIDTH] = (i+j)/512;
                }
            }
            this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
            this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.R32F, WIDTH, HEIGHT, 0, this.gl.RED, this.gl.FLOAT, data);
            // this.gl.generateMipmap(this.gl.TEXTURE_2D); // MipMaps not supported for This type of textures
        }

        this.sampler = this.gl.createSampler();
        this.sampler2 = this.gl.createSampler();

        this.gl.samplerParameteri(this.sampler2, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.samplerParameteri(this.sampler2, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.samplerParameteri(this.sampler2, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.samplerParameteri(this.sampler2, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);


        this.wrap_s = this.wrap_t = this.gl.REPEAT;
        this.mag_filter = this.min_filter = this.gl.NEAREST;

        this.camera = new Camera();
        this.camera.type = 'perspective';
        this.camera.position = vec3.fromValues(0,0,3);
        this.camera.direction = vec3.fromValues(0,0,-1);
        this.camera.aspectRatio = this.gl.drawingBufferWidth/this.gl.drawingBufferHeight;
        
        this.controller = new FlyCameraController(this.camera, this.game.input);
        this.controller.movementSensitivity = 0.001;

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

        this.mesh.setBufferData("texcoords", this.texcoordinates, this.gl.STREAM_DRAW);
        
        this.program.use();

        this.program.setUniformMatrix4fv("MVP", false, this.camera.ViewProjectionMatrix);
        this.program.setUniform4f("tint", [1, 1, 1, 1]);

        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_WRAP_S, this.wrap_s);
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_WRAP_T, this.wrap_t);
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_MAG_FILTER, this.mag_filter);
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_MIN_FILTER, this.min_filter);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[this.current_texture]);
        this.gl.bindSampler(0, this.sampler2);
        this.program.setUniform1i('texture_sampler', 0);
        
        this.mesh.draw(this.gl.TRIANGLES);
    }
    
    public end(): void {
        this.program.dispose();
        this.program = null;
        this.mesh.dispose();
        this.mesh = null;
        for(let texture of this.textures)
            this.gl.deleteTexture(texture);
        this.textures = [];
        this.gl.deleteSampler(this.sampler);
        this.clearControls();
    }


    /////////////////////////////////////////////////////////
    ////// ADD CONTROL TO THE WEBPAGE (NOT IMPORTNANT) //////
    /////////////////////////////////////////////////////////
    private setupControls() {
        const controls = document.querySelector('#controls');
        
        const wrapOptions = {
            [this.gl.CLAMP_TO_EDGE]:"Clamp to Edge",
            [this.gl.REPEAT]:"Repeat",
            [this.gl.MIRRORED_REPEAT]:"Mirrored Repeat"
        };

        const magfilteringOptions = {
            [this.gl.NEAREST]:"Nearest",
            [this.gl.LINEAR]:"Linear"
        };

        const minfilteringOptions = {
            [this.gl.NEAREST]:"Nearest",
            [this.gl.LINEAR]:"Linear",
            [this.gl.NEAREST_MIPMAP_NEAREST]:"Nearest MipMap Nearest",
            [this.gl.NEAREST_MIPMAP_LINEAR]:"Nearest MipMap Linear",
            [this.gl.LINEAR_MIPMAP_NEAREST]:"Linear MipMap Nearest",
            [this.gl.LINEAR_MIPMAP_LINEAR]:"Linear MipMap Linear"
        };

        controls.appendChild(
            <div>
                <div className="control-row">
                    <label className="control-label">Texture</label>
                    <Selector options={Object.fromEntries(this.textures.map((_,i)=>[i.toString(),i.toString()]))} value={this.current_texture.toString()} onchange={(v) => {this.current_texture = Number.parseInt(v)}}/>
                </div>
                <div className="control-row">
                    <label className="control-label">Top Left</label>
                    <Vector vector={this.texcoordinates} start={6} length={2}/>
                    <label className="control-label">Top Right</label>
                    <Vector vector={this.texcoordinates} start={4} length={2}/>
                </div>
                <div className="control-row">
                    <label className="control-label">Bottom Left</label>
                    <Vector vector={this.texcoordinates} start={0} length={2}/>
                    <label className="control-label">Bottom Right</label>
                    <Vector vector={this.texcoordinates} start={2} length={2}/>
                </div>
                <div className="control-row">
                    <label className="control-label">Wrap on S-Axis</label>
                    <Selector options={wrapOptions} value={this.wrap_s.toString()} onchange={(v) => {this.wrap_s = Number.parseInt(v)}}/>
                    <label className="control-label">Wrap on T-Axis</label>
                    <Selector options={wrapOptions} value={this.wrap_t.toString()} onchange={(v) => {this.wrap_t = Number.parseInt(v)}}/>
                </div>
                <div className="control-row">
                    <label className="control-label">Magnification Filter</label>
                    <Selector options={magfilteringOptions} value={this.mag_filter.toString()} onchange={(v) => {this.mag_filter = Number.parseInt(v)}}/>
                    <label className="control-label">Minification Filter</label>
                    <Selector options={minfilteringOptions} value={this.min_filter.toString()} onchange={(v) => {this.min_filter = Number.parseInt(v)}}/>
                </div>
            </div>
            
        );
        
    }

    private clearControls() {
        const controls = document.querySelector('#controls');
        controls.innerHTML = "";
    }


}