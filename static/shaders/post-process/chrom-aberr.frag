#version 300 es
precision highp float;

in vec2 v_screencoord;

out vec4 color;

uniform sampler2D color_sampler;


void main(){
    ivec2 size = textureSize(color_sampler, 0); // This will give us the size of a mip level of the texture
    vec2 texelSize = 1.0/vec2(size); // 1/size = the change in texture coordinates between a pixel and its neighbors 
    color.r = texture(color_sampler, v_screencoord - texelSize * vec2(10, 0)).r; // We read red from 10 pixels to the left
    color.g = texture(color_sampler, v_screencoord).g; // We read green from the center
    color.b = texture(color_sampler, v_screencoord + texelSize * vec2(10, 0)).b; // We read blue from 10 pixels to the right
    color.a = 1.0; // let alpha be 1. It doesn't matter but we need to give it a value.
}