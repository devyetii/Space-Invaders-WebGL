import { Scene } from '../common/game';
import ShaderProgram from '../common/shader-program';
import Mesh from '../common/mesh';
import Camera from '../common/camera';
import FlyCameraController from '../common/camera-controllers/fly-camera-controller';
import { vec3, mat4 } from 'gl-matrix';
import { Vector, Selector } from '../common/dom-utils';
import { createElement, StatelessProps, StatelessComponent } from 'tsx-create-element';
import { Plane, Cube } from '../common/mesh-utils';
import * as MeshUtils from '../common/mesh-utils';
import {player, enemy} from '../characters/spaceship';
import * as gameUtils from '../common/game-utils'
// In this scene we will draw one rectangle with a texture
export default class myGameScene extends Scene {
    camera: Camera;
    controller: FlyCameraController;
    textures: WebGLTexture[] = [];
    current_texture: number = 0;
    sampler: WebGLSampler;
    programs: {[name: string]: ShaderProgram} = {};
    meshes: {[name:string]: Mesh} = {};

   // enemyLevels: {[levNum: number]: enemy[]} = {};
// game attributes 
    myPlayer: player;
    enemyLevel: enemy[][];
    numOfBatches:number = 10;       // each batch has 3 enemies    
    batchDistance:number = 10; // this is the distance between each batch of enemies


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

    playerPosition: vec3 = vec3.fromValues(1,1,1);

    static readonly cubemapDirections = ['negx', 'negy', 'negz', 'posx', 'posy', 'posz'];

    public load(): void {
        // These shaders take 2 uniform: MVP for 3D transformation and Tint for modifying colors
        this.game.loader.load({
            ["texture.vert"]:{url:'shaders/texture.vert', type:'text'},
            ["texture.frag"]:{url:'shaders/texture.frag', type:'text'},
            ["sky.frag"]:{url:'shaders/sky.frag', type:'text'},
            ["sky.vert"]:{url:'shaders/sky.frag', type:'text'},
            ["texture"]:{url:'images/color-grid.png', type:'image'},
            ["sky-cube.vert"]:{url:'shaders/sky-cube.vert', type:'text'},
            ["sky-cube.frag"]:{url:'shaders/sky-cube.frag', type:'text'},
            ["spaceship"]:{url:'models/spaceships/spaceship.obj', type:'text'},
            ["spaceship-texture"]:{url:'models/spaceships/sh3.jpg', type:'image'},
            ["enemy-texture"]:{url:'models/spaceships/sh3_s.jpg', type:'image'},
             ...Object.fromEntries(myGameScene.cubemapDirections.map(dir=>[dir, {url:`images/space/${dir}.png`, type:'image'}]))

        });
    } 
    
    public start(): void {
        this.programs["cube"] = new ShaderProgram(this.gl);
        this.programs["cube"] .attach(this.game.loader.resources["texture.vert"], this.gl.VERTEX_SHADER);
        this.programs["cube"] .attach(this.game.loader.resources["texture.frag"], this.gl.FRAGMENT_SHADER);
        this.programs["cube"] .link();

        this.programs['sky'] = new ShaderProgram(this.gl);
        this.programs['sky'].attach(this.game.loader.resources["sky-cube.vert"], this.gl.VERTEX_SHADER);
        this.programs['sky'].attach(this.game.loader.resources["sky-cube.frag"], this.gl.FRAGMENT_SHADER);
        this.programs['sky'].link();
        
        this.meshes['spaceship'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["spaceship"]);        
        {
            this.textures[0] = this.gl.createTexture();
            this.gl.activeTexture(this.gl.TEXTURE0);
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
            for(let j = 0; j < HEIGHT; j++){
                for(let i = 0; i < WIDTH; i++){
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
            this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.R32F, WIDTH, HEIGHT, 0, this.gl.RED, this.gl.FLOAT, data);
            // this.gl.generateMipmap(this.gl.TEXTURE_2D); // MipMaps not supported for This type of textures
        }
       

        const target_directions = [
            this.gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            this.gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            this.gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
            this.gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            this.gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            this.gl.TEXTURE_CUBE_MAP_POSITIVE_Z
        ]


        this.textures[4] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.textures[4]);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        for(let i = 0; i < 6; i++){
            this.gl.texImage2D(target_directions[i], 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources[myGameScene.cubemapDirections[i]]);
        }
        this.gl.generateMipmap(this.gl.TEXTURE_CUBE_MAP);
        this.sampler = this.gl.createSampler();
        
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.samplerParameteri(this.sampler, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);

        this.wrap_s = this.wrap_t = this.gl.REPEAT;
        this.mag_filter = this.min_filter = this.gl.NEAREST;

        this.textures['spaceship'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['spaceship']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['spaceship-texture']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);

        this.camera = new Camera();
        this.camera.type = 'perspective';
        this.camera.position = vec3.fromValues(3,5,-10);
        this.camera.direction = vec3.fromValues(0,0,1);
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

          // Create a colored rectangle using our new Mesh class
          this.meshes["cube"] = Cube(this.gl);    

          this.meshes['sky'] = Cube(this.gl);
          this.programs["cube"].use();
          this.programs["cube"].setUniform1i("texture_sampler", 0);
          /// A draw the characters at the start of the game
            // A.1. draw the enemies

           this.enemyLevel = [];
            this.enemyLevel[0] = [];
            this.enemyLevel[0] [0]= new enemy(vec3.fromValues(0,0,20), 10, 2,2,2,3,vec3.fromValues(0,0,-1),100, this);
            this.enemyLevel[0] [1]= new enemy(vec3.fromValues(0,10,20), 10, 2,2,2,3,vec3.fromValues(0,0,-1),100, this);
            // A.2 draw the player
            this.myPlayer = new player(vec3.fromValues(0,0,0), 0, 2, 2, 2, 5, vec3.fromValues(0,0,1), 100, this);


           /*
            for(var i: number = 0; i < 10; i++) {
                //this.enemyLevel[i] = [];
                for(var j: number = 0; j< 10; j++) {
                  // this.enemyLevel[i][j] = new enemy(vec3.fromValues());

                }
            }*/

    }

    public draw(deltaTime: number): void {
        this.controller.update(deltaTime);

        if(this.game.input.isKeyJustDown("i")){
            vec3.scaleAndAdd(this.playerPosition , this.playerPosition, [0,0,1], 1);        
        }
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        this.programs["cube"] .use();
        this.meshes["cube"].setBufferData("texcoords", this.texcoordinates, this.gl.STREAM_DRAW);

        let VP = this.camera.ViewProjectionMatrix;
      
        let playerMat = mat4.clone(VP);
        
        mat4.translate(playerMat, playerMat, this.playerPosition);
        
        this.programs["cube"].setUniformMatrix4fv("MVP", false, playerMat);
        this.programs["cube"].setUniform4f("tint", [1, 1, 1, 1]);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['spaceship']);
        this.programs["cube"].setUniform1i('texture_sampler', 0);

        //this.meshes['spaceship'].draw(this.gl.TRIANGLES);
        this.myPlayer.draw(VP, this.programs["cube"]);
        this.enemyLevel[0][0].draw(VP, this.programs["cube"] );        

        this.drawSky(VP);
        // enemies and area code


       // 
    }
    
    public drawSky(VP: mat4){

  // the sky drawing
  let M = mat4.clone(VP); 
  mat4.translate(M,M,vec3.fromValues(0,0,-2)) ;          
  mat4.rotateY(M, M, performance.now()/1000);       

      
    this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.textures[4]);

      this.gl.cullFace(this.gl.FRONT);
      this.gl.depthMask(false);

      this.programs['sky'].use();

      this.programs['sky'].setUniformMatrix4fv("VP", false, this.camera.ViewProjectionMatrix);
      this.programs['sky'].setUniform3f("cam_position", this.camera.position);

      let skyMat = mat4.create();
      mat4.translate(skyMat, skyMat, this.camera.position);
      
      this.programs['sky'].setUniformMatrix4fv("M", false, skyMat);

      this.programs['sky'].setUniform4f("tint", [1, 1, 1, 1]);
      this.programs['sky'].setUniformMatrix4fv("M_it", true, mat4.invert(mat4.create(), M));


      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, this.textures[4]);
      this.programs['sky'].setUniform1i('cube_texture_sampler', 0);
      this.gl.bindSampler(0, this.sampler);

      this.meshes['sky'].draw(this.gl.TRIANGLES);
      
      this.gl.cullFace(this.gl.BACK);
      this.gl.depthMask(true); 


    }
    public end(): void {
        for(let key in this.programs){
            this.programs[key].dispose;
        }
        this.programs = {}
        for (let key in this.meshes){
            this.meshes[key].dispose;
        }
        this.meshes ={};
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
        
            
        
        
    }

    private clearControls() {
        const controls = document.querySelector('#controls');
        controls.innerHTML = "";
    }


}