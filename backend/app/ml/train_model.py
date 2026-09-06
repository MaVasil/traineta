import sys
from backend.app.database import SessionLocal
from backend.app.ml.feature_engineering import get_historical_features
from backend.app.ml.model import MLTrainer

def main():
    print("TrainETA ML Training\n")
    
    db = SessionLocal()
    try:
        print("Loading historical data...")
        df = get_historical_features(db)
        
        if df.empty or len(df) < 100:
            print("Insufficient historical data for training. Generate synthetic data first.")
            sys.exit(1)
            
        print(f"Rows: {len(df)}")
        print("Feature engineering complete.")
        
        trainer = MLTrainer()
        model, metadata = trainer.train_and_evaluate(df)
        
        trainer.save_model(model, metadata)
        
    finally:
        db.close()

if __name__ == "__main__":
    main()
