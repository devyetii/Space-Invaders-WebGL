// Here, we import the things we need from other script files 
import Game from './common/game';
import TextureScene from './scenes/01-Texture';
import TexturedModelsScene from './scenes/02-TexturedModels';
import TerrianScene from './scenes/03-Terrain';
import CubemapScene from './scenes/04-Cubemaps';
import BlendingScene from './scenes/05-Blending';
import myTerrianScene from './scenes/06-myTerrain';
import myGameScene from './scenes/myGameScene'

// First thing we need is to get the canvas on which we draw our scenes
const canvas: HTMLCanvasElement = document.querySelector("#app");

// Then we create an instance of the game class and give it the canvas
const game = new Game(canvas);

// Here we list all our scenes and our initial scene
const scenes = {
    "Texture": TextureScene,
    "Textured Models": TexturedModelsScene,
    "Terrain": TerrianScene,
    "Cubemap": CubemapScene,
    "Blending": BlendingScene,
    "myGameScene": myGameScene,
    "myTerrian": myTerrianScene
};
const initialScene = "myGameScene";

// Then we add those scenes to the game object and ask it to start the initial scene
game.addScenes(scenes);
game.startScene(initialScene);

// Here we setup a selector element to switch scenes from the webpage
const selector: HTMLSelectElement = document.querySelector("#scenes");
for(let name in scenes){
    let option = document.createElement("option");
    option.text = name;
    option.value = name;
    selector.add(option);
}
selector.value = initialScene;
selector.addEventListener("change", ()=>{
    game.startScene(selector.value);
});