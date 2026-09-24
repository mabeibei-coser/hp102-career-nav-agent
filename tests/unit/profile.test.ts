import { describe, it, expect } from "vitest";
import {
  profileInputSchema,
  missingRequired,
  labelOfEducation,
  toJobFormData,
  type ProfileSnapshot,
} from "@/lib/career/profile";

describe("profile", () => {
  it("parses valid profile input with default empty targetPosition", () => {
    const result = profileInputSchema.parse({
      identity: "recent_grad",
      birthDate: "2003-05",
      education: "bachelor",
      workYears: "lt1",
    });
    expect(result.targetPosition).toBe("");
  });

  it("rejects invalid birthDate, education, and targetPosition", () => {
    expect(() =>
      profileInputSchema.parse({
        identity: "recent_grad",
        birthDate: "2003-13",
        education: "bachelor",
        workYears: "lt1",
      }),
    ).toThrow();

    expect(() =>
      profileInputSchema.parse({
        identity: "recent_grad",
        birthDate: "1939-01",
        education: "bachelor",
        workYears: "lt1",
      }),
    ).toThrow();

    expect(() =>
      profileInputSchema.parse({
        identity: "recent_grad",
        birthDate: "2003-05",
        education: "doctor",
        workYears: "lt1",
      }),
    ).toThrow();

    expect(() =>
      profileInputSchema.parse({
        identity: "recent_grad",
        birthDate: "2003-05",
        education: "bachelor",
        workYears: "lt1",
        targetPosition: "x".repeat(61),
      }),
    ).toThrow();
  });

  it("missingRequired, labelOfEducation, and toJobFormData work correctly", () => {
    expect(missingRequired({ identity: "recent_grad" })).toEqual([
      "birthDate",
      "education",
      "workYears",
    ]);
    expect(labelOfEducation("bachelor")).toBe("本科");

    const snapshot: ProfileSnapshot = {
      identity: "recent_grad",
      birthDate: "2003-05",
      education: "bachelor",
      workYears: "lt1",
      targetPosition: "行政专员",
      profileVersion: 1,
      resumeFileId: null,
      resumeFileName: "resume.pdf",
      resumeStoragePath: "user/file.pdf",
      resumeText: "简历正文",
      extractedName: "张三",
      extractedPhone: "13800138000",
    };

    const formData = toJobFormData(snapshot);
    expect(formData.education).toBe("bachelor");
    expect(formData.workYears).toBe("lt1");
    expect(formData.name).toBe("张三");
    expect(formData.phone).toBe("13800138000");
    expect(formData.resumeText).toBe("简历正文");
    expect(formData.resumeFileName).toBe("resume.pdf");
  });
});
