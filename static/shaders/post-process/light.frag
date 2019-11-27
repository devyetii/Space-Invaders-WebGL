#version 300 es
precision highp float;

in vec2 v_screencoord;

out vec4 color;

uniform sampler2D color_sampler;
uniform sampler2D normal_sampler;
uniform vec3 light_direction;
uniform vec4 light_color;
uniform vec4 ambient_color;

void main(){
    vec3 normal = texture(normal_sampler, v_screencoord).xyz;
    color = texture(color_sampler, v_screencoord) * (max(0.0, dot(normal, light_direction))*light_color + ambient_color);
    // This is just basic lambert lighting. We will explore it more in the next lab. 
}