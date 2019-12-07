import { vec3, mat4, quat } from 'gl-matrix';
//This is the abstract base of all scenes
 
export abstract class spaceShip {
    pos:vec3; // this is the center position
    
    width:number;
    height:number;
    length:number;

    speed:number;
    shootPower:number;  // we have to rethink of this
    diretion: vec3;
    health: number;

    
   
    public constructor(pos: vec3, speed:number, width:number, height:number, length:number, shootPower:number, direction:vec3, health:number){
        this.pos = pos;
        this.speed = speed;
        this.shootPower = shootPower;
        this.diretion = direction;
        this.health = health;  
        this.width = width;
        this.height = height;
        this.length = length;      
    }
    
    
   
}

export  class  player extends spaceShip {
    score:number;
}

export class enemy extends spaceShip{


} 