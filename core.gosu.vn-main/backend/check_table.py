#!/usr/bin/env python3
"""Check database table structure for global_glossary"""

import asyncio
from app.db.session import get_db
from sqlalchemy import inspect

async def main():
    try:
        # Get database session
        db = await get_db().__anext__()

        # Use run_sync for inspection
        async def inspect_db():
            return await db.run_sync(lambda conn: inspect(conn))

        inspector = await db.run_sync(lambda conn: inspect(conn))

        # Check if table exists
        tables = inspector.get_table_names()
        print('All tables:', tables)

        # Check if our tables exist
        global_glossary_exists = 'global_glossary' in tables or 'global_glossarys' in tables
        game_category_exists = 'game_category' in tables

        print(f'\nglobal_glossary table exists: {global_glossary_exists}')
        print(f'game_category table exists: {game_category_exists}')

        if global_glossary_exists:
            table_name = 'global_glossary' if 'global_glossary' in tables else 'global_glossarys'
            print(f'\nglobal_glossary table name: {table_name}')
            columns = inspector.get_columns(table_name)
            print('global_glossary columns:')
            for col in columns:
                nullable = col.get('nullable', True)
                default = col.get('default', None)
                print(f'  {col["name"]}: {col["type"]} (nullable: {nullable}, default: {default})')

        if game_category_exists:
            print(f'\ngame_category table name: game_category')
            columns = inspector.get_columns('game_category')
            print('game_category columns:')
            for col in columns:
                nullable = col.get('nullable', True)
                default = col.get('default', None)
                print(f'  {col["name"]}: {col["type"]} (nullable: {nullable}, default: {default})')

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())