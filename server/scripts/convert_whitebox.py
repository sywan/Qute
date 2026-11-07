"""Convert the official White-box Cartoonization TF checkpoint (test_code/saved_models) to ONNX.

Usage: python scripts/convert_whitebox.py path/to/saved_models/model-33999 ../public/models/whitebox-cartoon.onnx
Requires: tensorflow, tf2onnx. Re-implements test_code/network.py + guided_filter (r=1, eps=5e-3)
with the checkpoint weights, NHWC float input in [-1, 1].
"""
import numpy as np, tensorflow as tf, tf2onnx, sys
ckpt = sys.argv[1]; out = sys.argv[2]
r = tf.train.load_checkpoint(ckpt)
W = {k: r.get_tensor(k) for k in r.get_variable_to_shape_map()}
def conv(x, name, stride=1):
    return tf.nn.conv2d(x, tf.constant(W[f"generator/{name}/weights"]), stride, "SAME") + tf.constant(W[f"generator/{name}/biases"])
lr = lambda x: tf.nn.leaky_relu(x, 0.2)
def box(x, r_, ch):
    k = 2*r_+1
    return tf.nn.depthwise_conv2d(x, tf.constant(np.ones((k,k,ch,1),np.float32)/(k*k)), [1,1,1,1], 'SAME')
def gf(x, y, r_=1, eps=5e-3):
    s = tf.shape(x)
    N = box(tf.ones((1, s[1], s[2], 1)), r_, 1)
    mx, my = box(x,r_,3)/N, box(y,r_,3)/N
    cxy = box(x*y,r_,3)/N - mx*my; vx = box(x*x,r_,3)/N - mx*mx
    A = cxy/(vx+eps); b = my - A*mx
    return box(A,r_,3)/N*x + box(b,r_,3)/N
@tf.function(input_signature=[tf.TensorSpec([1,None,None,3], tf.float32, name='input')])
def model(inp):
    x0 = lr(conv(inp,'Conv'))
    x1 = lr(conv(x0,'Conv_1',2)); x1 = lr(conv(x1,'Conv_2'))
    x2 = lr(conv(x1,'Conv_3',2)); x2 = lr(conv(x2,'Conv_4'))
    for i in range(4):
        h = lr(conv(x2,f'block_{i}/conv1')); x2 = conv(h,f'block_{i}/conv2') + x2
    x2 = lr(conv(x2,'Conv_5'))
    s = tf.shape(x2); x3 = tf.compat.v1.image.resize_bilinear(x2, (s[1]*2, s[2]*2))
    x3 = lr(conv(x3+x1,'Conv_6')); x3 = lr(conv(x3,'Conv_7'))
    s = tf.shape(x3); x4 = tf.compat.v1.image.resize_bilinear(x3, (s[1]*2, s[2]*2))
    x4 = lr(conv(x4+x0,'Conv_8')); x4 = conv(x4,'Conv_9')
    return tf.identity(gf(inp, x4), name='output')
tf2onnx.convert.from_function(model, input_signature=model.input_signature, opset=13, output_path=out)
np.random.seed(0); t = np.random.uniform(-1,1,(1,64,96,3)).astype(np.float32)
np.save(out+'.ref.npy', np.stack([t, model(t).numpy()]))
print('ok')
