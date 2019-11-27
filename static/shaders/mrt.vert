#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in vec4 color;
layout(location=2) in vec2 texcoord;
layout(location=3) in vec3 normal;

out vec4 v_color;
out vec2 v_texcoord;
out vec3 v_normal;

uniform mat4 M;
uniform mat4 M_it;
uniform mat4 VP;

void main(){
    gl_Position = VP * M * vec4(position, 1.0f); 
    v_color = color;
    v_texcoord = texcoord;
    v_normal = (M_it * vec4(normal, 0.0f)).xyz;
}

// This shader is the same as texture.vert but we add the normals since we need to render it to one of our targets in the fragment shader