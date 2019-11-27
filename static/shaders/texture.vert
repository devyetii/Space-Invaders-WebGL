#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in vec4 color;
layout(location=2) in vec2 texcoord; // We have a new attribute "texcoord" that contains the texture coordinates of the vertex

out vec4 v_color;
out vec2 v_texcoord; // We will pass the texture coordinates to the fragment shader

uniform mat4 MVP;

void main(){
    gl_Position = MVP * vec4(position, 1.0f); 
    v_color = color;
    v_texcoord = texcoord; // pass the texture coordinates as is to the fragment shader
}