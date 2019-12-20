#version 300 es
precision highp float;

in vec4 v_color;
in vec3 v_view;
in vec3 v_normal;

out vec4 color;

uniform samplerCube cube_texture_sampler;
uniform vec4 tint;

uniform bool refraction;
uniform float refractive_index;

void main(){
    vec3 direction;
    if(refraction){
        direction = refract(v_view, normalize(v_normal), refractive_index);
    } else {
        direction = reflect(v_view, normalize(v_normal));    
    }
    color = texture(cube_texture_sampler, direction) * v_color * tint;
}