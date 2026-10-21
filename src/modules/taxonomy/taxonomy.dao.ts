import { pool, DbClient } from '../../db/pool';

export interface AreaConocimiento {
  id: string;
  nombre: string;
  slug: string;
  icono_url: string | null;
  activa: boolean;
}

export interface CreateAreaData {
  nombre: string;
  slug: string;
  icono_url?: string | null;
  activa?: boolean;
}

export interface UpdateAreaData {
  nombre?: string;
  slug?: string;
  icono_url?: string | null;
  activa?: boolean;
}

export interface TagAcademico {
  id: string;
  nombre: string;
  slug: string;
}

export interface CreateTagData {
  nombre: string;
  slug: string;
}

export interface UpdateTagData {
  nombre?: string;
  slug?: string;
}

export class TaxonomyDao {
  // ==========================================
  // ÁREAS DE CONOCIMIENTO
  // ==========================================

  /**
   * List areas of knowledge, optionally filtered by active status.
   */
  static async listAreas(
    onlyActive = false,
    db: DbClient = pool
  ): Promise<AreaConocimiento[]> {
    const query = onlyActive
      ? `SELECT id, nombre, slug, icono_url, activa 
         FROM areas_conocimiento 
         WHERE activa = TRUE 
         ORDER BY nombre ASC;`
      : `SELECT id, nombre, slug, icono_url, activa 
         FROM areas_conocimiento 
         ORDER BY nombre ASC;`;

    const result = await db.query<AreaConocimiento>(query);
    return result.rows;
  }

  /**
   * Find an area of knowledge by its UUID.
   */
  static async findAreaById(id: string, db: DbClient = pool): Promise<AreaConocimiento | null> {
    const query = `
      SELECT id, nombre, slug, icono_url, activa 
      FROM areas_conocimiento 
      WHERE id = $1 
      LIMIT 1;
    `;
    const result = await db.query<AreaConocimiento>(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find an area of knowledge by its slug.
   */
  static async findAreaBySlug(slug: string, db: DbClient = pool): Promise<AreaConocimiento | null> {
    const query = `
      SELECT id, nombre, slug, icono_url, activa 
      FROM areas_conocimiento 
      WHERE slug = $1 
      LIMIT 1;
    `;
    const result = await db.query<AreaConocimiento>(query, [slug]);
    return result.rows[0] || null;
  }

  /**
   * Find an area of knowledge by exact name.
   */
  static async findAreaByNombre(nombre: string, db: DbClient = pool): Promise<AreaConocimiento | null> {
    const query = `
      SELECT id, nombre, slug, icono_url, activa 
      FROM areas_conocimiento 
      WHERE LOWER(nombre) = LOWER($1) 
      LIMIT 1;
    `;
    const result = await db.query<AreaConocimiento>(query, [nombre]);
    return result.rows[0] || null;
  }

  /**
   * Insert a new area of knowledge.
   */
  static async createArea(
    data: CreateAreaData,
    db: DbClient = pool
  ): Promise<AreaConocimiento> {
    const query = `
      INSERT INTO areas_conocimiento (
        nombre,
        slug,
        icono_url,
        activa
      ) VALUES ($1, $2, $3, $4)
      RETURNING id, nombre, slug, icono_url, activa;
    `;
    const values = [
      data.nombre,
      data.slug,
      data.icono_url ?? null,
      data.activa ?? true,
    ];
    const result = await db.query<AreaConocimiento>(query, values);
    return result.rows[0];
  }

  /**
   * Update an existing area of knowledge dynamically.
   */
  static async updateArea(
    id: string,
    data: UpdateAreaData,
    db: DbClient = pool
  ): Promise<AreaConocimiento | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (data.nombre !== undefined) {
      fields.push(`nombre = $${index++}`);
      values.push(data.nombre);
    }
    if (data.slug !== undefined) {
      fields.push(`slug = $${index++}`);
      values.push(data.slug);
    }
    if (data.icono_url !== undefined) {
      fields.push(`icono_url = $${index++}`);
      values.push(data.icono_url);
    }
    if (data.activa !== undefined) {
      fields.push(`activa = $${index++}`);
      values.push(data.activa);
    }

    if (fields.length === 0) {
      return this.findAreaById(id, db);
    }

    values.push(id);
    const query = `
      UPDATE areas_conocimiento
      SET ${fields.join(', ')}
      WHERE id = $${index}
      RETURNING id, nombre, slug, icono_url, activa;
    `;

    const result = await db.query<AreaConocimiento>(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete an area of knowledge by ID.
   */
  static async deleteArea(id: string, db: DbClient = pool): Promise<boolean> {
    const query = `DELETE FROM areas_conocimiento WHERE id = $1 RETURNING id;`;
    const result = await db.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ==========================================
  // TAGS ACADÉMICOS
  // ==========================================

  /**
   * List all academic tags.
   */
  static async listTags(db: DbClient = pool): Promise<TagAcademico[]> {
    const query = `
      SELECT id, nombre, slug 
      FROM tags_academicos 
      ORDER BY nombre ASC;
    `;
    const result = await db.query<TagAcademico>(query);
    return result.rows;
  }

  /**
   * Find an academic tag by ID.
   */
  static async findTagById(id: string, db: DbClient = pool): Promise<TagAcademico | null> {
    const query = `
      SELECT id, nombre, slug 
      FROM tags_academicos 
      WHERE id = $1 
      LIMIT 1;
    `;
    const result = await db.query<TagAcademico>(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find an academic tag by slug.
   */
  static async findTagBySlug(slug: string, db: DbClient = pool): Promise<TagAcademico | null> {
    const query = `
      SELECT id, nombre, slug 
      FROM tags_academicos 
      WHERE slug = $1 
      LIMIT 1;
    `;
    const result = await db.query<TagAcademico>(query, [slug]);
    return result.rows[0] || null;
  }

  /**
   * Find an academic tag by exact name.
   */
  static async findTagByNombre(nombre: string, db: DbClient = pool): Promise<TagAcademico | null> {
    const query = `
      SELECT id, nombre, slug 
      FROM tags_academicos 
      WHERE LOWER(nombre) = LOWER($1) 
      LIMIT 1;
    `;
    const result = await db.query<TagAcademico>(query, [nombre]);
    return result.rows[0] || null;
  }

  /**
   * Insert a new academic tag.
   */
  static async createTag(
    data: CreateTagData,
    db: DbClient = pool
  ): Promise<TagAcademico> {
    const query = `
      INSERT INTO tags_academicos (
        nombre,
        slug
      ) VALUES ($1, $2)
      RETURNING id, nombre, slug;
    `;
    const values = [data.nombre, data.slug];
    const result = await db.query<TagAcademico>(query, values);
    return result.rows[0];
  }

  /**
   * Update an existing academic tag.
   */
  static async updateTag(
    id: string,
    data: UpdateTagData,
    db: DbClient = pool
  ): Promise<TagAcademico | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (data.nombre !== undefined) {
      fields.push(`nombre = $${index++}`);
      values.push(data.nombre);
    }
    if (data.slug !== undefined) {
      fields.push(`slug = $${index++}`);
      values.push(data.slug);
    }

    if (fields.length === 0) {
      return this.findTagById(id, db);
    }

    values.push(id);
    const query = `
      UPDATE tags_academicos
      SET ${fields.join(', ')}
      WHERE id = $${index}
      RETURNING id, nombre, slug;
    `;

    const result = await db.query<TagAcademico>(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete an academic tag by ID.
   */
  static async deleteTag(id: string, db: DbClient = pool): Promise<boolean> {
    const query = `DELETE FROM tags_academicos WHERE id = $1 RETURNING id;`;
    const result = await db.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
