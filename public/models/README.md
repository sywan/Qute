# Qute browser models

These ONNX files are served by GitHub Pages and run in the visitor's browser with ONNX Runtime Web.
Each keeps its upstream licence; most are **non-commercial**.

| File | Algorithm | Source | Licence | Notes |
| --- | --- | --- | --- | --- |
| `animeganv3-hayao.onnx` | AnimeGANv3 (Hayao 36) | [TachibanaYoshino/AnimeGANv3](https://github.com/TachibanaYoshino/AnimeGANv3) release v1.1.0 | Author licence: non-commercial (academic research, teaching, publications) | Unmodified |
| `animeganv3-shinkai.onnx` | AnimeGANv3 (Shinkai 37) | same, release v1.1.0 | same | Unmodified |
| `animeganv2-shinkai.onnx` | AnimeGANv2 (Shinkai 53) | [TachibanaYoshino/AnimeGANv2](https://github.com/TachibanaYoshino/AnimeGANv2) `pb_and_onnx_model/` | Author licence: non-commercial | Unmodified |
| `whitebox-cartoon.onnx` | White-box Cartoonization | [SystemErrorWang/White-box-Cartoonization](https://github.com/SystemErrorWang/White-box-Cartoonization) `test_code/saved_models` | CC BY-NC-SA 4.0 (© Xinrui Wang) | Converted from the official TensorFlow checkpoint with `server/scripts/convert_whitebox.py` (generator + guided filter r=1, eps=5e-3). Max abs. difference vs. TF: 2.4e-6. This converted file is shared under the same CC BY-NC-SA 4.0 licence. |
| `yunet-2023mar.onnx` | YuNet face detector | [opencv/opencv_zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) | MIT (© Shiqi Yu) | Unmodified; used for chibi/cute warps and face protection |

Commercial use of Qute with these weights needs permission from the respective authors.

## References

- Chen, J., Liu, G., & Chen, X. (2020). AnimeGAN: A novel lightweight GAN for photo animation. In *Artificial Intelligence Algorithms and Applications (ISICA 2019)*, CCIS 1205, Springer, 242–256.
- Wang, X., & Yu, J. (2020). Learning to cartoonize using white-box cartoon representations. *CVPR*, 8090–8099.
- Wu, W., Peng, H., & Yu, S. (2023). YuNet: A tiny millisecond-level face detector. *Machine Intelligence Research*, 20(5), 656–665.
