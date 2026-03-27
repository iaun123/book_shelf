import json

def generate_log_file(start, end, filename="log.json"):
    # 1. Create a list of strings from start to end
    # range(start, end + 1) ensures the end number is included
    log_data = [str(num) for num in range(start, end + 1)]

    # 2. Format the list as a JSON-style string with 2-space indentation
    formatted_json = json.dumps(log_data, indent=2)

    # 3. Print the result to your console
    # print("--- Console Output ---")
    # print(formatted_json)
    # print("----------------------")

    # 4. Save the result to a file
    try:
        with open(filename, "w") as f:
            f.write(formatted_json)
        # print(f"\nSuccess! File '{filename}' has been created.")
    except Exception as e:
        print(f"\nAn error occurred while saving: {e}")

# Change these two numbers to customize your range
start_num = 1
end_num = 20

generate_log_file(start_num, end_num)