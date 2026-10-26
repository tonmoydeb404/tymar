use rusqlite_migration::{Migrations, M};

pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("sql/v1__initial.sql")),
        M::up(include_str!("sql/v2__domain_tables.sql")),
        M::up(include_str!("sql/v3__sync_health.sql")),
    ])
}
