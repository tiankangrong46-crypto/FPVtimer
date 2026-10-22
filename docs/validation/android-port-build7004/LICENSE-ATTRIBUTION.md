# 独立许可与署名

此文件是数据许可附件，不参与匹配、计算或主界面展示；发布该数据包及其改编内容时应随附。

数据集：FPV-DB Open Dataset。署名：**FPV-DB**，https://fpv-db.com 。

数据许可：Creative Commons Attribution 4.0 International（CC BY 4.0）。
许可链接：https://creativecommons.org/licenses/by/4.0/ 。
上游许可原文：https://github.com/fpvdb/fpv-db-data/blob/main/LICENSE 。

改动说明：删除数据行中的厂商、品牌、产品名称、链接、备注和采集来源；以定子规格、KV和可解析的桨叶几何参数建立匿名分类；保留不同测试组的匿名编号；功率按表列电压乘电流重算；不保留可追溯到品牌的原始产品编号；按完全相同的表列电压分出覆盖内插值候选段。没有将数据变成经独立验证的续航参考。

原始数据由上游汇总厂商及零售商资料，不代表本项目重新做过台架实验。上游不保证全部字段准确；本包的数值检查不构成整机预测精度验证。数据中缺失的测试条件仍为未知。

本包 tools 中的整理与验证代码为本次新写代码，采用下方 MIT 许可。代码许可不替代上方数据的 CC BY 4.0 许可。

MIT License

Copyright (c) 2026 FPV Endurance contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

该附件中的来源信息仅用于履行许可与复现核查，不放入业务数据行。用户已明确允许此独立附件。

<!-- SNAPSHOT -->

Snapshot base: https://raw.githubusercontent.com/fpvdb/fpv-db-data/889e73afac7fab8ce37ff4d7589209d5b4dd552f

- motors.json: SHA-256 `d4f778c4376eb1c73a5954572e54af53ffbf7abe2f1073dc1a683491eba8c86e`
- props.json: SHA-256 `cb94048c8fc46ffe6e274c3c347992c7c2dbe77ed1842b89995b02363d3f6cb3`
