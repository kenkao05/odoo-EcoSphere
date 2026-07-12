import { makeCrudRouter } from "../lib/crudFactory";
import {
  departments, categories, emissionFactors, productEsgProfiles, esgPolicies, badges, rewards, audits,
} from "../db/schema";
import * as v from "../lib/validation";

export const departmentsRouter = makeCrudRouter({
  table: departments, idColumn: departments.id,
  insertSchema: v.departmentInsert, updateSchema: v.departmentUpdate,
  searchColumns: [departments.name, departments.code],
});

export const categoriesRouter = makeCrudRouter({
  table: categories, idColumn: categories.id,
  insertSchema: v.categoryInsert, updateSchema: v.categoryUpdate,
  searchColumns: [categories.name],
});

export const emissionFactorsRouter = makeCrudRouter({
  table: emissionFactors, idColumn: emissionFactors.id,
  insertSchema: v.emissionFactorInsert, updateSchema: v.emissionFactorUpdate,
  searchColumns: [emissionFactors.name, emissionFactors.activityType],
});

export const productsRouter = makeCrudRouter({
  table: productEsgProfiles, idColumn: productEsgProfiles.id,
  insertSchema: v.productEsgProfileInsert, updateSchema: v.productEsgProfileUpdate,
  searchColumns: [productEsgProfiles.name, productEsgProfiles.sku],
});

export const policiesRouter = makeCrudRouter({
  table: esgPolicies, idColumn: esgPolicies.id,
  insertSchema: v.esgPolicyInsert, updateSchema: v.esgPolicyUpdate,
  searchColumns: [esgPolicies.title],
});

export const badgesRouter = makeCrudRouter({
  table: badges, idColumn: badges.id,
  insertSchema: v.badgeInsert, updateSchema: v.badgeUpdate,
  searchColumns: [badges.name],
});

export const rewardsAdminRouter = makeCrudRouter({
  table: rewards, idColumn: rewards.id,
  insertSchema: v.rewardInsert, updateSchema: v.rewardUpdate,
  searchColumns: [rewards.name],
});

export const auditsRouter = makeCrudRouter({
  table: audits, idColumn: audits.id,
  insertSchema: v.auditInsert, updateSchema: v.auditUpdate,
  searchColumns: [audits.title],
});