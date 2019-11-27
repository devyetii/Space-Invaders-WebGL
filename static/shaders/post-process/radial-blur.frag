#version 300 es
precision highp float;

in vec2 v_screencoord;

out vec4 color;

uniform sampler2D color_sampler;
uniform float sigma;

const int WINDOW = 47;

void main(){
    ivec2 size = textureSize(color_sampler, 0);
    vec2 texelSize = 1.0/vec2(size);

    float two_sigma_sqr = 2.0*sigma*sigma;
    vec2 delta_step = (2.0*v_screencoord - 1.0) * length(texelSize);

    float total_weight = 0.0;
    color = vec4(0);
    // Here we calculate a weighted mean from samples located on a radial direction
    for(int i = 0; i <= WINDOW; i++){
        float weight = exp(-float(i*i)/two_sigma_sqr);
        color += texture(color_sampler, v_screencoord + float(i) * delta_step) * weight;
        total_weight += weight;
    }
    color /= total_weight;
}