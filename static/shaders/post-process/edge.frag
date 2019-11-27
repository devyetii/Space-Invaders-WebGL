#version 300 es
precision highp float;

in vec2 v_screencoord;

out vec4 color;

uniform sampler2D depth_sampler;
uniform sampler2D normal_sampler;
uniform mat4 P_i; // Projection matrix inverse

// This function reads depth and normals and returns a vec4 containing the normal in xyz and the distance from camera in the w.
vec4 sample_normal_and_depth(vec2 coord){
    float depth = texture(depth_sampler, coord).x; // read the depth from the depth texture
    vec4 inv_projected = P_i * vec4(2.0*v_screencoord.x-1.0, 2.0*v_screencoord.y-1.0, 2.0*depth-1.0, 1.0); // regenerate the NDC and multiply by projection inverse
    inv_projected = inv_projected / inv_projected.w; // Divide by w to get the point in view space
    vec3 normal = texture(normal_sampler, coord).xyz; // Read the normal
    return vec4(normal, length(inv_projected)); // return the normal and distance
}

// List of points from which we sample the neighbors
const vec2 offsets[8] = vec2[8](
    vec2(-1, -1),
    vec2(-1, 0),
    vec2(-1, 1),
    vec2(0, -1),
    vec2(0, 1),
    vec2(1, -1),
    vec2(1, 0),
    vec2(1, 1)
);

void main(){
    ivec2 size = textureSize(depth_sampler, 0); // This will give us the size of a mip level of the texture
    vec2 texelSize = 1.0/vec2(size); // 1/size = the change in texture coordinates between a pixel and its neighbors 

    vec4 center = sample_normal_and_depth(v_screencoord); // read the center pixel
    vec4 others = vec4(0.0);
    // get the mean of the 8 neighboring pixels
    for(int i = 0; i < 8; i++) others += sample_normal_and_depth(v_screencoord + texelSize * offsets[i]);
    others /= 8.0;
    float edge = distance(center, others); // the edge exists when the distance between the center  and the neighboring pixel is large.
    color = vec4(edge, edge, edge, 1);
}