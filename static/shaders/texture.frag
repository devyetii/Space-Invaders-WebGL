#version 300 es
precision highp float;

in vec4 v_color;
in vec2 v_texcoord; // texture coordinates received from the vertex shader

out vec4 color;

uniform vec4 tint;
uniform sampler2D texture_sampler; // the sampler using which we will sample colors from the texture 

void main(){
    // the texture function takes a sampler and texture coordinates and returns a vec4 containing the color
    // Note that the color is alwas vec4 no matter the texture type. 
    color = texture(texture_sampler, v_texcoord) * v_color * tint;
}