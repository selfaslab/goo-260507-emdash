declare module "better-sqlite3" {
	class Database {
		constructor(filename: string);
		prepare(sql: string): { run(...params: unknown[]): { changes: number } };
		close(): void;
	}
	export default Database;
}
