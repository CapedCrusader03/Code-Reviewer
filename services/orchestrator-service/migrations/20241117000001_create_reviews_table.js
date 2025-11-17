/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('reviews', (table) => {
    table.increments('id').primary();
    table.uuid('job_id').notNullable().unique().index();
    table.string('repo', 255).notNullable();
    table.integer('pr_number').notNullable();
    table.string('commit_sha', 255).notNullable();
    table.enum('status', ['pending', 'running', 'done', 'failed']).defaultTo('pending');
    table.integer('quality_score').nullable();
    table.text('static_metrics').nullable();
    table.string('github_comment_id', 255).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('completed_at').nullable();
    
    table.index(['repo', 'pr_number']);
    table.index('status');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('reviews');
};

