"""
Test script for fetch_url tool
Run from project root: python test-fetch-url.py
"""
import asyncio
import sys
import os

# Add app directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from quendoo.tools import get_web_fetch_service


async def test_html_fetch():
    """Test fetching HTML page"""
    print("=" * 60)
    print("TEST 1: Fetch HTML page (example.com)")
    print("=" * 60)

    service = get_web_fetch_service()
    result = await service.fetch_url(
        url="https://example.com",
        format="html",
        timeout=10
    )

    print(f"Success: {result.get('success')}")
    if result.get('success'):
        print(f"Title: {result.get('title')}")
        print(f"Content Type: {result.get('contentType')}")
        print(f"Status Code: {result.get('statusCode')}")
        print(f"Content preview (first 200 chars):\n{result.get('content', '')[:200]}...")
    else:
        print(f"Error: {result.get('error')}")
    print()


async def test_json_fetch():
    """Test fetching JSON API"""
    print("=" * 60)
    print("TEST 2: Fetch JSON API (GitHub API)")
    print("=" * 60)

    service = get_web_fetch_service()
    result = await service.fetch_url(
        url="https://api.github.com/repos/anthropics/anthropic-sdk-python",
        format="json",
        timeout=10
    )

    print(f"Success: {result.get('success')}")
    if result.get('success'):
        content = result.get('content', {})
        print(f"Repo name: {content.get('name')}")
        print(f"Stars: {content.get('stargazers_count')}")
        print(f"Forks: {content.get('forks_count')}")
        print(f"Language: {content.get('language')}")
        print(f"Description: {content.get('description')}")
    else:
        print(f"Error: {result.get('error')}")
    print()


async def test_invalid_url():
    """Test fetching invalid/private URL"""
    print("=" * 60)
    print("TEST 3: Invalid URL (localhost - should be blocked)")
    print("=" * 60)

    service = get_web_fetch_service()
    result = await service.fetch_url(
        url="http://localhost:8080",
        format="html",
        timeout=10
    )

    print(f"Success: {result.get('success')}")
    print(f"Error: {result.get('error')}")
    print()


async def test_rate_limiting():
    """Test rate limiting"""
    print("=" * 60)
    print("TEST 4: Rate limiting (11 requests in 1 minute)")
    print("=" * 60)

    service = get_web_fetch_service()

    for i in range(11):
        result = await service.fetch_url(
            url="https://example.com",
            format="html",
            timeout=10,
            api_key="test_hotel_123"
        )
        print(f"Request {i+1}: {result.get('success')} - {result.get('error', 'OK')}")

        if not result.get('success') and 'Rate limit' in result.get('error', ''):
            print("✅ Rate limiting working correctly!")
            break
    print()


async def test_timeout():
    """Test timeout handling"""
    print("=" * 60)
    print("TEST 5: Timeout (1 second timeout on slow endpoint)")
    print("=" * 60)

    service = get_web_fetch_service()
    result = await service.fetch_url(
        url="https://httpbin.org/delay/5",  # Delays 5 seconds
        format="json",
        timeout=1  # 1 second timeout
    )

    print(f"Success: {result.get('success')}")
    print(f"Error: {result.get('error')}")

    if 'timeout' in result.get('error', '').lower():
        print("✅ Timeout handling working correctly!")
    print()


async def test_content_truncation():
    """Test content truncation (10K chars limit)"""
    print("=" * 60)
    print("TEST 6: Content truncation")
    print("=" * 60)

    service = get_web_fetch_service()
    result = await service.fetch_url(
        url="https://www.gutenberg.org/files/1342/1342-0.txt",  # Pride and Prejudice (large text)
        format="text",
        timeout=15
    )

    print(f"Success: {result.get('success')}")
    if result.get('success'):
        content = result.get('content', '')
        print(f"Content length: {len(content)} characters")

        if len(content) <= 10000:
            print("✅ Content truncation working correctly!")

        if '[Content truncated]' in content:
            print("✅ Truncation message present!")
    else:
        print(f"Error: {result.get('error')}")
    print()


async def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("FETCH_URL TOOL TEST SUITE")
    print("=" * 60 + "\n")

    try:
        await test_html_fetch()
        await test_json_fetch()
        await test_invalid_url()
        await test_rate_limiting()
        await test_timeout()
        await test_content_truncation()

        print("=" * 60)
        print("ALL TESTS COMPLETED")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
