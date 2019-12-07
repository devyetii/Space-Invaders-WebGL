import { vec3, mat4, quat } from 'gl-matrix';
import {player, enemy} from './spaceship'
//This is the abstract base of all scenes

enum BOOSTER_TYPE {
    ASTEROID = 1,
    HEALTHBOOST = 2,
    SPEEDBOOST = 3,
    ENEMYBOOST = 4
}
export  class booseter {
    pos:vec3; 
    // the following are the width, height and length of a cube surrounding the object   
    width:number;
    height:number;
    length:number;
    type:BOOSTER_TYPE;
    boostValue:number;  // this is the value to boost by
       
   
    public constructor(pos: vec3, width:number, height:number, length:number,  boostValue:number){
        this.pos = pos;       
        this.width = width;
        this.height = height;
        this.length = length;      
        this.boostValue = boostValue;
    }
    public boost(_player:player, _enemies:Array<enemy>):void{
        if(this.type == BOOSTER_TYPE.ASTEROID){
            
        }
        else if (this.type == BOOSTER_TYPE.ENEMYBOOST) {
            
        }
        else if (this.type == BOOSTER_TYPE.HEALTHBOOST) {
            
        }
        else if (this.type == BOOSTER_TYPE.SPEEDBOOST) {
            
        } else {
            
        }

    }
   
}
