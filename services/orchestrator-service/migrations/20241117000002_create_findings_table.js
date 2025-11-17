/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('findings', (table) => {
    table.increments('id').primary();
    table.integer('review_id').unsigned().notNullable();
    table.enum('type', ['code_smell', 'security_issue', 'suggestion', 'best_practice']).notNullable();
    table.enum('severity', ['low', 'medium', 'high', 'critical']).notNullable();
    table.string('file_path', 500).nullable();
    table.integer('line_number').nullable();
    table.text('message').notNullable();
    table.text('suggestion').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.foreign('review_id').references('id').inTable('reviews').onDelete('CASCADE');
    table.index('review_id');
    table.index('type');
    table.index('severity');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('findings');
};

