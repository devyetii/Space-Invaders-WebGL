#version 300 es
precision highp float;

const float offset = 1.0 / 300.0;  


in vec4 v_color;
in vec2 v_texcoord;

out vec4 color;
const float contrast = 0.3f; 
uniform vec4 tint;
uniform sampler2D texture_sampler;

void main(){
    

   color = vec4(vec3(1.0 - texture(texture_sampler, v_texcoord)),1.0) ; // Send our interpolated color
   



}