"""
Profession Archives Desktop Application
Combines FastAPI backend with PyWebView native window
"""
import os
import sys
import threading
import time
import json
from pathlib import Path
import asyncio

import webview
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn

# Import backend app
from backend.app.main import app as fastapi_app
from backend.app.db import init_db


def get_frontend_path():
    """Get the path to frontend dist directory"""
    if getattr(sys, 'frozen', False):
        # Running as PyInstaller executable
        base_path = sys._MEIPASS
    else:
        # Running from source
        base_path = Path(__file__).parent
    
    frontend_dist = Path(base_path) / 'frontend' / 'dist'
    return frontend_dist


def setup_app():
    """Setup FastAPI app with static file serving"""
    frontend_dist = get_frontend_path()
    
    # Mount frontend static files
    if frontend_dist.exists():
        fastapi_app.mount(
            "/assets",
            StaticFiles(directory=frontend_dist / "assets"),
            name="assets"
        )
    
    # Add SPA fallback route (lowest priority)
    # This will only handle routes that don't match API endpoints
    @fastapi_app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """Serve index.html for all non-API routes (SPA support)"""
        # Skip if this looks like an API call
        if full_path.startswith("api/") or full_path == "":
            # Let FastAPI handle it
            return None
        
        index_path = frontend_dist / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        
        return {"error": "Frontend not found"}
    
    return fastapi_app


def run_server(port: int = 8000):
    """Run FastAPI server in background thread"""
    # Initialize database
    init_db()
    
    # Setup app with static files
    app = setup_app()
    
    # Create server config
    config = uvicorn.Config(
        app=app,
        host="127.0.0.1",
        port=port,
        log_level="info",
        access_log=False
    )
    server = uvicorn.Server(config)
    
    # Run in thread
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    
    # Wait for server to start
    time.sleep(2)
    return f"http://127.0.0.1:{port}"


def main():
    """Main entry point for desktop app"""
    port = 8000
    api_url = run_server(port)
    
    # Create native window
    webview.create_window(
        title='Profession Archives',
        url=api_url,
        width=1400,
        height=900,
        min_size=(800, 600),
        resizable=True,
        fullscreen=False,
        background_color='#0f172a'
    )
    
    webview.start(debug=False)


if __name__ == '__main__':
    main()
