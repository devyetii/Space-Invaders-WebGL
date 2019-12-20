#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in vec4 color;
layout(location=2) in vec2 texcoord;

out vec4 v_color;
out vec2 v_texcoord;
out vec3 v_view;

uniform mat4 M;
uniform mat4 VP;
uniform vec3 cam_position;

uniform sampler2D terrain_texture_sampler;

void main(){
    float height = texture(terrain_texture_sampler, texcoord).r;
    vec4 world = M * vec4(position + vec3(0, height, 0), 1.0f);
    gl_Position = VP * world; 
    v_color = color;
    v_texcoord = texcoord;
    v_view = world.xyz - cam_position;
}