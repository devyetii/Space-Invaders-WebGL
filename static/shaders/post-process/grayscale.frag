#version 300 es
precision highp float;

in vec2 v_screencoord;

out vec4 color;

uniform sampler2D color_sampler;

void main(){
    vec4 original = texture(color_sampler, v_screencoord);
    float luminance = dot(original.rgb, vec3(0.3086, 0.6094, 0.0820)); // The luminance can be calculated by many formulae. This is one of them
    color = vec4(luminance, luminance, luminance, 1); // since r, g and b are all the same, it is grayscale
}