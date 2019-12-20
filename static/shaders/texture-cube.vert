#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in vec4 color;
layout(location=3) in vec3 normal;

out vec4 v_color;
out vec3 v_view;
out vec3 v_normal;

uniform mat4 M;
uniform mat4 M_it;
uniform mat4 VP;
uniform vec3 cam_position;


void main(){
    vec4 world = M * vec4(position, 1.0f);
    gl_Position = VP * world; 
    v_color = color;
    v_view = world.xyz ;
    v_normal = (M_it * vec4(normal, 0.0f)).xyz;
}