#version 300 es
precision highp float;

in vec2 v_screencoord;

out vec4 color;

uniform sampler2D color_sampler;
uniform float sigma;

const int WINDOW = 5; // The window size will be (2*WINDOW+1) x (2*WINDOW+1)

void main(){
    ivec2 size = textureSize(color_sampler, 0); // This will give us the size of a mip level of the texture
    vec2 texelSize = 1.0/vec2(size); // 1/size = the change in texture coordinates between a pixel and its neighbors 

    float two_sigma_sqr = 2.0*sigma*sigma; // the denominator of the gaussian function exponent

    float total_weight = 0.0;
    color = vec4(0);
    // We loop over every pixel in the window and calculate a weighted sum
    for(int i = -WINDOW; i <= WINDOW; i++){
        for(int j = -WINDOW; j <= WINDOW; j++){
            float weight = exp(-float(i*i+j*j)/two_sigma_sqr);
            color += texture(color_sampler, v_screencoord + texelSize * vec2(i, j)) * weight;
            total_weight += weight;
        }
    }
    color /= total_weight; // We divide by the total weight to normalize the sum
}