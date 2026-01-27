#!/usr/bin/env python3

import sys
sys.path.append('backend')

try:
    from app.modules.game_glossary.schemas import Game_GlossaryCreate
    from app.modules.game_glossary.models import Game_Glossary

    # Test creating a Game_GlossaryCreate instance
    create_data = Game_GlossaryCreate(
        term="test term",
        translated_term="thuật ngữ dịch",
        language_pair="en-vi",
        usage_count=0,
        game_id=1,
        is_active=True
    )

    # Test converting to dict (Pydantic v2 method)
    dict_data = create_data.model_dump()
    print("✅ Pydantic model_dump() works")

    # Test creating SQLAlchemy model with dict data
    model = Game_Glossary(**dict_data)
    print("✅ SQLAlchemy model creation works")

    print("🎉 All tests passed! The fix should work.")

except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)