#version 300 es
precision highp float;

in vec4 v_color;
in vec2 v_texcoord;
in vec3 v_normal;

// Now we have 2 outputs, one for each render target
layout(location=0) out vec4 color; // This will be sent to the first attachment
layout(location=1) out vec4 normal; // This will be sent to the second attachment

uniform vec4 tint;
uniform sampler2D texture_sampler;

void main(){
    color = texture(texture_sampler, v_texcoord) * v_color * tint; // Send our interpolated color
    normal = vec4(normalize(v_normal), 1.0f);
}