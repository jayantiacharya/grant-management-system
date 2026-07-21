import { Router, Response } from "express";
import dbo from "../middleware/conn.js";
import { verifyToken, AuthRequest } from "../middleware/auth.js";

const router = Router();

// Mirrors the arcc-lookup pattern used by isArccMember in grantSubmission.ts,
// but checks chairId specifically since this report is the chair's tool
// rather than something every ARCC member needs (per PR #53 review).
// chairId can be null when no chair is assigned; in that case only admins
// can reach the page, which is fine for now.
async function isARCCChairOrAdmin(req: AuthRequest): Promise<boolean> {
  const role = req.user?.role?.toLowerCase();
  if (role === "admin") return true;

  const userId = req.user?.userId;
  if (!userId) return false;

  const db = dbo.getDb();
  const arcc = await db.collection("arcc").findOne({ key: "committee" });

  return arcc?.chairId != null && String(arcc.chairId) === String(userId);
}

type DonorReportGrant = {
  _id: string;
  title: string;
  submittedEmail: string;
  college: string;
  department: string;
  allocatedAmount: number;
};

// GET /api/donor-report/grants
// Returns every funded grant (allocatedAmount > 0) enriched with the
// submitter's college/department, for the ARCC donor-facing report page.
// Aggregation (totals by college/department, amount buckets, top grants)
// is computed client-side from this flat list.
router.get("/grants", verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isARCCChairOrAdmin(req))) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const db = dbo.getDb();

    const fundedGrants = await db
      .collection("grant")
      .find({ allocatedAmount: { $gt: 0 } })
      .toArray();

    const emails = Array.from(
      new Set(
        fundedGrants.map((grant: any) => grant.submittedEmail).filter(Boolean),
      ),
    );

    const users = await db
      .collection("user")
      .find({ email: { $in: emails } })
      .project({ email: 1, college: 1, department: 1 })
      .toArray();

    const infoByEmail = new Map(
      users.map((user: any) => [
        user.email,
        {
          college: user.college || "Unknown",
          department: user.department || "Unknown",
        },
      ]),
    );

    const report: DonorReportGrant[] = fundedGrants.map((grant: any) => {
      const info = infoByEmail.get(grant.submittedEmail) ?? {
        college: "Unknown",
        department: "Unknown",
      };

      return {
        _id: grant._id.toString(),
        title: grant.title || "Untitled Grant",
        submittedEmail: grant.submittedEmail || "Unknown",
        college: info.college,
        department: info.department,
        allocatedAmount: Number(grant.allocatedAmount) || 0,
      };
    });

    return res.json(report);
  } catch (err) {
    console.error("Failed to build donor report:", err);
    return res.status(500).json({ message: "Failed to build donor report" });
  }
});

export default router;
