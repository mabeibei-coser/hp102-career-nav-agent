import { Document, Packer, Paragraph, TextRun } from "docx";

export async function makeResumeDocx(lines?: string[]): Promise<Buffer> {
  const content = lines ?? [
    "张三",
    "手机：13800138000",
    "学历：本科",
    "求职意向：行政专员",
    "工作经历：",
    "2022-2024 某科技公司 行政助理，负责日常办公协调与文档整理。",
    "2020-2022 某贸易公司 文员，协助处理客户咨询与资料归档。",
  ];
  const doc = new Document({
    sections: [
      {
        children: content.map(
          (line) => new Paragraph({ children: [new TextRun(line)] }),
        ),
      },
    ],
  });
  return await Packer.toBuffer(doc);
}
