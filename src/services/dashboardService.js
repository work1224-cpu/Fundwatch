const { sequelize, Scheme, Category, AMC, SchemeReturn, RiskMeasure } = require("../models");
const { QueryTypes } = require("sequelize");

async function getKPIs() {
  const [row] = await sequelize.query(`
    SELECT
      (SELECT COUNT(*) FROM categories) AS totalCategories,
      (SELECT COUNT(*) FROM schemes WHERE is_active = 1) AS totalSchemes,
      (SELECT COUNT(*) FROM amcs) AS totalAMCs,
      (SELECT AVG(aum) FROM schemes WHERE aum IS NOT NULL) AS avgAUM,
      (SELECT MAX(nav) FROM schemes) AS highestNAV,
      (SELECT MIN(nav) FROM schemes WHERE nav IS NOT NULL) AS lowestNAV,
      (SELECT MAX(aum) FROM schemes) AS largestAUM
  `, { type: QueryTypes.SELECT });

  const best = async (period) => sequelize.query(`
    SELECT s.id, s.name, sr.value FROM scheme_returns sr
    JOIN schemes s ON s.id = sr.scheme_id
    WHERE sr.period = :period ORDER BY sr.value DESC LIMIT 1
  `, { replacements: { period }, type: QueryTypes.SELECT });

  const worst = async (period) => sequelize.query(`
    SELECT s.id, s.name, sr.value FROM scheme_returns sr
    JOIN schemes s ON s.id = sr.scheme_id
    WHERE sr.period = :period ORDER BY sr.value ASC LIMIT 1
  `, { replacements: { period }, type: QueryTypes.SELECT });

  const [best1y] = await best("1Y");
  const [worst1y] = await worst("1Y");
  const [best3y] = await best("3Y");
  const [best5y] = await best("5Y");
  const [best10y] = await best("10Y");

  const [lowestRisk] = await sequelize.query(`
    SELECT s.name, rm.value FROM risk_measures rm
    JOIN schemes s ON s.id = rm.scheme_id
    WHERE rm.metric = 'stdDev' AND rm.value > 0 ORDER BY rm.value ASC LIMIT 1
  `, { type: QueryTypes.SELECT });

  const topCategory = await sequelize.query(`
    SELECT c.name AS category, AVG(sr.value) AS avg1y FROM scheme_returns sr
    JOIN schemes s ON s.id = sr.scheme_id
    JOIN categories c ON c.id = s.category_id
    WHERE sr.period = '1Y'
    GROUP BY c.id ORDER BY avg1y DESC LIMIT 1
  `, { type: QueryTypes.SELECT });

  return {
    ...row,
    best1Y: best1y || null, worst1Y: worst1y || null,
    best3Y: best3y || null, best5Y: best5y || null, best10Y: best10y || null,
    lowestRisk: lowestRisk || null,
    topCategory: topCategory[0] || null,
    asOf: new Date().toISOString().slice(0, 10),
  };
}

async function getCategoryPerformance() {
  return sequelize.query(`
    SELECT c.name AS category, AVG(sr.value) AS avg1Y, COUNT(DISTINCT s.id) AS schemeCount
    FROM categories c
    JOIN schemes s ON s.category_id = c.id
    LEFT JOIN scheme_returns sr ON sr.scheme_id = s.id AND sr.period = '1Y'
    GROUP BY c.id
    ORDER BY avg1Y DESC
  `, { type: QueryTypes.SELECT });
}

module.exports = { getKPIs, getCategoryPerformance };
