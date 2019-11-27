#version 300 es
precision highp float;

in vec2 v_screencoord;

out vec4 color;

uniform sampler2D color_sampler;
uniform sampler2D depth_sampler;
uniform float fog_distance;
uniform vec4 fog_color;
uniform mat4 P_i; // Projection matrix inverse

float fogAmount(float dist){
    return 1.0 - exp( -dist / fog_distance );
}

void main(){
    float depth = texture(depth_sampler, v_screencoord).x; // read the depth from the depth texture
    vec4 inv_projected = P_i * vec4(2.0*v_screencoord.x-1.0, 2.0*v_screencoord.y-1.0, 2.0*depth-1.0, 1.0); // regenerate the NDC and multiply by projection inverse
    inv_projected = inv_projected / inv_projected.w; // Divide by w to get the point in view space
    float fog_amount = fogAmount(length(inv_projected)); // get fog amount based the distance between the pixel and the camera
    color = mix(texture(color_sampler, v_screencoord), fog_color, fog_amount); // interpolate between the pixel color and fog color
}