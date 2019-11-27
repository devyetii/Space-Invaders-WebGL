#version 300 es
precision highp float;

in vec2 v_screencoord;

out vec4 color;

uniform sampler2D color_sampler;

void main(){
    color = texture(color_sampler, v_screencoord + 0.01 * vec2(sin(v_screencoord.y*40.0), sin(v_screencoord.x*40.0))); // Just use a sine wave to distort the texture
}