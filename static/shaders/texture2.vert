#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in vec4 color;
layout(location=2) in vec2 texcoord;

out vec4 v_color;
out vec2 v_texcoord;

uniform mat4 MVP;

void main(){
    gl_Position = MVP * vec4(position, 1.0f); 
    v_color = color;
    v_texcoord = texcoord;
}