#!/usr/bin/env python3
"""
Convert Canadian Listed Terrorist Entities CSV to Data Management Service Format
一键转换脚本 - 将原始CSV转换为后端服务可识别的格式

使用方法:
python3 convert_terrorist_csv_for_upload.py

输出文件: canadian_terrorist_entities_ready_for_upload.csv
"""

import csv
import re
import os
from datetime import datetime

def convert_terrorist_csv():
    """转换恐怖实体CSV为数据管理服务期望的格式"""

    input_file = '/Users/kanbei/Code/chainreactions_backend/canadian_listed_terrorist_entities.csv'
    output_file = '/Users/kanbei/Code/chainreactions_backend/canadian_terrorist_entities_ready_for_upload.csv'

    print("🔧 转换加拿大恐怖实体CSV...")
    print(f"📥 输入文件: {input_file}")
    print(f"📤 输出文件: {output_file}")

    # 检查输入文件是否存在
    if not os.path.exists(input_file):
        print(f"❌ 错误: 找不到输入文件 {input_file}")
        return False

    try:
        with open(input_file, 'r', encoding='utf-8') as infile, \
             open(output_file, 'w', encoding='utf-8', newline='') as outfile:

            reader = csv.DictReader(infile)

            # 定义后端期望的列名
            fieldnames = [
                'organization_name',    # 对应原 CSV 的 'name'
                'external_id',          # 对应原 CSV 的 'entity_id'
                'schema_type',          # 新增字段
                'description',          # 对应原 CSV 的 'description'
                'aliases',              # 对应原 CSV 的 'aliases'
                'published_date',       # 对应原 CSV 的 'published_date'
                'updated_date',         # 对应原 CSV 的 'updated_date'
                'data_source_url'       # 对应原 CSV 的 'data_source_url'
            ]

            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()

            converted_rows = 0
            fixed_dates = 0

            for row in reader:
                try:
                    # 转换列名到后端期望的格式
                    converted_row = {
                        'organization_name': row['name'],
                        'external_id': row['entity_id'],
                        'schema_type': 'Terrorist Organization',
                        'description': row['description'],
                        'aliases': row['aliases'],
                        'published_date': row['published_date'],
                        'updated_date': row['updated_date'],
                        'data_source_url': row['data_source_url']
                    }

                    # 修复日期格式 - 将 "Not yet reviewed" 转换为空值
                    if converted_row['published_date'] == 'Not yet reviewed' or not converted_row['published_date'] or not converted_row['published_date'].strip():
                        converted_row['published_date'] = None

                    if converted_row['updated_date'] == 'Not yet reviewed' or not converted_row['updated_date'] or not converted_row['updated_date'].strip():
                        converted_row['updated_date'] = None

                    # 验证日期格式
                    for date_field in ['published_date', 'updated_date']:
                        if converted_row[date_field] and converted_row[date_field].strip():
                            if not re.match(r'^\d{4}-\d{2}-\d{2}$', converted_row[date_field].strip()):
                                converted_row[date_field] = None
                                fixed_dates += 1

                    writer.writerow(converted_row)
                    converted_rows += 1

                except Exception as e:
                    print(f"⚠️  跳过行 {row.get('entity_id', 'unknown')}: {e}")
                    continue

        print(f"✅ 转换完成!")
        print(f"📊 成功转换 {converted_rows} 行")
        print(f"🔧 修复日期格式 {fixed_dates} 处")

        # 显示转换示例
        print(f"\n📋 转换示例:")
        with open(output_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                if i >= 2:  # 显示前3行
                    break
                print(f"\n--- 第 {i+1} 行 ---")
                print(f"组织名称: {row['organization_name']}")
                print(f"外部ID: {row['external_id']}")
                print(f"类型: {row['schema_type']}")
                print(f"发布日期: {row['published_date']}")
                print(f"更新日期: {row['updated_date']}")

        print(f"\n🎯 使用说明:")
        print(f"1. 在 Dataset Management 页面创建新数据集")
        print(f"2. 使用转换后的文件: {output_file}")
        print(f"3. 上传成功后，数据会自动导入到数据库")

        return True

    except Exception as e:
        print(f"❌ 转换失败: {e}")
        return False

def main():
    """主函数"""
    print("=" * 60)
    print("🇨🇦 加拿大恐怖实体CSV转换工具")
    print("🎯 将原始CSV转换为Data Management Service兼容格式")
    print("=" * 60)

    success = convert_terrorist_csv()

    if success:
        print("\n🚀 转换成功! 您现在可以上传转换后的CSV文件了。")
        return 0
    else:
        print("\n💥 转换失败! 请检查错误信息。")
        return 1

if __name__ == "__main__":
    exit(main())