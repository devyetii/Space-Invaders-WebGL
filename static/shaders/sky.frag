#version 300 es
precision highp float;

in vec3 v_view;

out vec4 color;

uniform samplerCube cube_texture_sampler;
uniform vec4 tint;


void main(){
    color = texture(cube_texture_sampler, v_view) * tint;
}