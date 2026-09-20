// Akademiya C++ Sandbox
#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::cout << "Hello from Akademiya C++ Sandbox!" << std::endl;
    std::vector<int> nums = {10, 20, 30, 40, 50};
    int sum = std::accumulate(nums.begin(), nums.end(), 0);
    std::cout << "Vector sum: " << sum << std::endl;
    return 0;
}
