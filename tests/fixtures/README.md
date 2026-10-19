# 真实测量夹具

`real-electrical-segment.json` 来源：Thiago A. Rodrigues et al., **Data Collected with Package Delivery Quadcopter Drone**, 2021，CC BY 4.0。

- 论文：https://www.nature.com/articles/s41597-021-00930-x
- 数据：https://doi.org/10.1184/R1/12683453
- 原始文件：https://ndownloader.figshare.com/files/26385070 ，`flights.zip / flights/1.csv`
- 原始 ZIP 的发布方 MD5：`cd1d267fd9b025219f9633b95158eea2`
- 改动：仅截取40–100秒，保留time、电压、电流；不包含位置/姿态等数据。端点若需要插值，单独标记。重新用梯形积分计算电量与时间加权平均电流。
- 目的：校验mAh/秒与平均电流的单位换算。**不能验证普通穿越机续航范围或内阻压降精度**。原始电压是负载数据，不冒充起飞/落地停桨电压。

此夹具只用于开发测试，不进入应用资源。其他测试中的650.5g等配置为人工夹具，不是真实飞行。
