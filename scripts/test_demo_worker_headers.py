import unittest

from demo_worker_http import internal_api_headers


class DemoWorkerHeadersTest(unittest.TestCase):
    def test_local_app_requests_use_the_canonical_host(self):
        headers = internal_api_headers("test-token")

        self.assertEqual(headers["Host"], "softwarevala.net")
        self.assertEqual(headers["x-internal-token"], "test-token")


if __name__ == "__main__":
    unittest.main()
