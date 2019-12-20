export class SamplerState2D {
    gl: WebGL2RenderingContext;
    wrap_s: number;
    wrap_t: number;
    mag_filter: number;
    min_filter: number;
    anisotropic_filter?: number;

    private anisotropic_filter_ext: EXT_texture_filter_anisotropic;

    constructor(gl: WebGL2RenderingContext){
        this.gl = gl;
        this.anisotropic_filter_ext = this.gl.getExtension('EXT_texture_filter_anisotropic');
        this.wrap_s = this.gl.REPEAT;
        this.wrap_t = this.gl.REPEAT;
        this.mag_filter = this.gl.LINEAR;
        this.min_filter = this.gl.LINEAR_MIPMAP_LINEAR;
    }

    public get supportAnisotropicFiltering(): boolean {
        return !!this.anisotropic_filter_ext;
    }

    public apply() {
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S,  this.wrap_s);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T,  this.wrap_t);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER,  this.mag_filter);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER,  this.min_filter);
        if(this.anisotropic_filter && this.anisotropic_filter_ext)
            this.gl.texParameterf(this.gl.TEXTURE_2D, this.anisotropic_filter_ext.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropic_filter);
    }
}

export class Texture2D {
    gl: WebGL2RenderingContext;
    texture: WebGLTexture;

    constructor(gl: WebGL2RenderingContext){
        this.gl = gl;
        this.texture = this.gl.createTexture();
    }

    public dispose(){
        this.gl.deleteTexture(this.texture);
    }

    public bind(){
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    }

    public setImage(source: ImageData | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap, level: number = 0){
        this.bind();
        this.gl.texImage2D(this.gl.TEXTURE_2D, level, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, source);
    }

    public setData(internalFormat: number, width: number, height: number, format: number, type: number, pixels?: ArrayBufferView, level: number = 0){
        this.bind();
        this.gl.texImage2D(this.gl.TEXTURE_2D, level, internalFormat, width, height, 0, format, type, pixels);
    }

    public generateMipMap() {
         this.bind();
         this.gl.generateMipmap(this.gl.TEXTURE_2D);
    }
}