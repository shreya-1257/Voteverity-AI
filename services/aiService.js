const { Ballot, User, Election, SuspiciousActivity } = require('../models');
const { Op } = require('sequelize');

class AIService {
  /**
   * Analyzes anonymized voting records to detect anomalies, velocity spikes,
   * and suspicious patterns without compromising voter privacy.
   */
  async detectSuspiciousActivity() {
    const ballots = await Ballot.findAll({
      order: [['created_at', 'ASC']],
      attributes: ['id', 'selections', 'ballot_hash', 'created_at']
    });

    const anomalies = [];
    const totalVotes = ballots.length;

    if (totalVotes < 3) {
      return {
        integrityScore: 100,
        riskLevel: 'LOW',
        totalAnalyzed: totalVotes,
        anomalies: [],
        summary: 'Insufficient data points for anomaly modeling. Election integrity nominal.'
      };
    }

    // 1. Time-window velocity & burst analysis
    // Detect abnormal spikes (e.g., > 5 votes cast within 15 seconds)
    const windowSeconds = 15;
    const maxAllowedInWindow = 5;

    for (let i = 0; i < ballots.length; i++) {
      const windowStart = new Date(ballots[i].created_at).getTime();
      let burstCount = 1;

      for (let j = i + 1; j < ballots.length; j++) {
        const diff = (new Date(ballots[j].created_at).getTime() - windowStart) / 1000;
        if (diff <= windowSeconds) {
          burstCount++;
        } else {
          break;
        }
      }

      if (burstCount >= maxAllowedInWindow) {
        anomalies.push({
          type: 'RAPID_BURST_VOTING',
          severity: burstCount > 8 ? 'CRITICAL' : 'HIGH',
          description: `Unusual velocity spike detected: ${burstCount} ballots submitted within ${windowSeconds} seconds.`,
          metrics: { burstCount, timeWindowSeconds: windowSeconds, timestamp: ballots[i].created_at }
        });
        i += burstCount - 1; // Skip window
      }
    }

    // 2. Repetitive Sequence / Sybil Pattern Detection
    // Flag multiple consecutive identical ballots cast within rapid succession
    let consecutiveIdentical = 1;
    for (let i = 1; i < ballots.length; i++) {
      const prevSel = typeof ballots[i - 1].selections === 'string' ? ballots[i - 1].selections : JSON.stringify(ballots[i - 1].selections);
      const currSel = typeof ballots[i].selections === 'string' ? ballots[i].selections : JSON.stringify(ballots[i].selections);
      const timeDiff = (new Date(ballots[i].created_at).getTime() - new Date(ballots[i - 1].created_at).getTime()) / 1000;

      if (prevSel === currSel && timeDiff < 30) {
        consecutiveIdentical++;
        if (consecutiveIdentical >= 4) {
          anomalies.push({
            type: 'REPETITIVE_PATTERN_ANOMALY',
            severity: 'MEDIUM',
            description: `Identical ballot selections submitted repeatedly (${consecutiveIdentical} times) in under 30s.`,
            metrics: { repetitions: consecutiveIdentical, timestamp: ballots[i].created_at }
          });
        }
      } else {
        consecutiveIdentical = 1;
      }
    }

    // Calculate dynamic integrity score
    let score = 100;
    anomalies.forEach(a => {
      if (a.severity === 'CRITICAL') score -= 25;
      else if (a.severity === 'HIGH') score -= 15;
      else if (a.severity === 'MEDIUM') score -= 8;
      else score -= 4;
    });
    score = Math.max(10, Math.min(100, score));

    const riskLevel = score >= 85 ? 'LOW' : score >= 65 ? 'MEDIUM' : 'HIGH';

    return {
      integrityScore: score,
      riskLevel,
      totalAnalyzed: totalVotes,
      anomalies,
      summary: riskLevel === 'LOW'
        ? 'AI Audit: No critical patterns of fraud or automated voting detected.'
        : `AI Audit: ${anomalies.length} potential voting patterns flagged for review.`
    };
  }

  /**
   * Generates aggregate election metrics and voter turnout analytics
   * strictly maintaining voter secret ballot anonymity.
   */
  async getElectionAnalytics() {
    const [totalRegistered, approvedVoters, pendingVoters, rejectedVoters, totalVotes] = await Promise.all([
      User.count({ where: { role: 'student' } }),
      User.count({ where: { role: 'student', approval_status: 'approved' } }),
      User.count({ where: { role: 'student', approval_status: 'pending' } }),
      User.count({ where: { role: 'student', approval_status: 'rejected' } }),
      Ballot.count()
    ]);

    const turnoutPercentage = approvedVoters > 0
      ? Math.round((totalVotes / approvedVoters) * 100)
      : 0;

    // Department participation breakdown (aggregate counts of voters who voted vs total)
    const departments = await User.findAll({
      where: { role: 'student' },
      attributes: ['department', 'has_voted', 'approval_status']
    });

    const deptStats = {};
    departments.forEach(s => {
      const dept = s.department || 'General';
      if (!deptStats[dept]) {
        deptStats[dept] = { total: 0, approved: 0, voted: 0 };
      }
      deptStats[dept].total++;
      if (s.approval_status === 'approved') deptStats[dept].approved++;
      if (s.has_voted) deptStats[dept].voted++;
    });

    const departmentTurnout = Object.entries(deptStats).map(([dept, data]) => ({
      department: dept,
      totalStudents: data.total,
      approvedVoters: data.approved,
      votesCast: data.voted,
      turnoutRate: data.approved > 0 ? Math.round((data.voted / data.approved) * 100) : 0
    }));

    return {
      totalRegistered,
      approvedVoters,
      pendingVoters,
      rejectedVoters,
      totalVotesCast: totalVotes,
      turnoutPercentage,
      departmentTurnout
    };
  }
}

module.exports = new AIService();
